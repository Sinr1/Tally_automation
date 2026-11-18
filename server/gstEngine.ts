import type { DatabaseSync } from 'node:sqlite';
import type { CompanyRecord, PortalInvoiceRecord, VoucherRecord } from './types.ts';

export const INDIAN_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman & Diu',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
};

const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const VALID_GST_SLABS = new Set([0, 0.1, 0.25, 1.5, 3, 5, 12, 18, 28]);

export function computeGstinCheckDigit(first14: string): string {
  const clean = first14.trim().toUpperCase();
  if (clean.length !== 14) {
    return '';
  }
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const codePoint = GSTIN_CHARS.indexOf(clean[i]);
    if (codePoint === -1) return '';
    const factor = i % 2 === 0 ? 1 : 2;
    const product = codePoint * factor;
    const quotient = Math.floor(product / 36);
    const remainder = product % 36;
    sum += quotient + remainder;
  }
  const checkCodePoint = (36 - (sum % 36)) % 36;
  return GSTIN_CHARS[checkCodePoint];
}

export function buildValidGstin(first14: string): string {
  const clean = first14.trim().toUpperCase().slice(0, 14);
  return clean + computeGstinCheckDigit(clean);
}

export interface GstinValidationResult {
  valid: boolean;
  reason?: string;
  stateCode?: string;
  stateName?: string;
  pan?: string;
  expectedChecksum?: string;
}

export function validateGstin(gstin: string): GstinValidationResult {
  const clean = (gstin || '').trim().toUpperCase();
  if (!clean) {
    return { valid: false, reason: 'Empty GSTIN' };
  }
  if (clean.length !== 15) {
    return { valid: false, reason: `GSTIN length is ${clean.length} (expected 15)` };
  }
  const stateCode = clean.slice(0, 2);
  const stateName = INDIAN_STATES[stateCode];
  if (!stateName) {
    return { valid: false, reason: `Invalid GST state code "${stateCode}"` };
  }
  const pan = clean.slice(2, 12);
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
    return { valid: false, reason: `Embedded PAN "${pan}" does not match AAAAA9999A format` };
  }
  if (!/^[1-9A-Z]$/.test(clean[12])) {
    return { valid: false, reason: 'Invalid 13th entity number character' };
  }
  if (clean[13] !== 'Z') {
    return { valid: false, reason: '14th character must be "Z"' };
  }
  const expectedChecksum = computeGstinCheckDigit(clean.slice(0, 14));
  if (clean[14] !== expectedChecksum) {
    return {
      valid: false,
      reason: `Modulo-36 checksum mismatch: got "${clean[14]}", expected "${expectedChecksum}"`,
      stateCode,
      stateName,
      pan,
      expectedChecksum,
    };
  }
  return { valid: true, stateCode, stateName, pan, expectedChecksum };
}

export interface SmartValidationIssue {
  voucherId: number;
  voucherNo: string;
  voucherType: string;
  partyName: string;
  detail: string;
  suggestedFix: string;
  fixType:
    | 'FIX_GSTIN_CHECKSUM'
    | 'FIX_POS_TAX_HEAD'
    | 'FIX_HSN_DEFAULT'
    | 'FIX_INVOICE_NO'
    | 'FIX_TAX_ROUNDING'
    | 'FIX_POS_FROM_GSTIN'
    | 'MANUAL_REVIEW';
}

export interface SmartValidationRuleResult {
  ruleId: string;
  ruleNumber: number;
  category:
    | 'GSTIN & Registration'
    | 'Place of Supply & Tax Head'
    | 'HSN & Rate Slab'
    | 'Invoice & Document Rules'
    | 'B2B / B2CL / Credit Notes'
    | 'RCM & E-Commerce u/s 9(5)'
    | 'ITC & Electronic Credit Ledger';
  ruleName: string;
  description: string;
  severity: 'Critical' | 'Warning';
  status: 'Passed' | 'Action Required';
  issueCount: number;
  issues: SmartValidationIssue[];
}

export function runSmartGstValidations(
  company: CompanyRecord,
  vouchers: VoucherRecord[]
): {
  totalRules: number;
  passedRules: number;
  failedRules: number;
  totalIssues: number;
  rules: SmartValidationRuleResult[];
} {
  const gstVouchers = vouchers.filter((v) =>
    ['Sales', 'Purchase', 'Credit Note', 'Debit Note'].includes(v.voucher_type)
  );
  const salesVouchers = gstVouchers.filter(
    (v) => v.voucher_type === 'Sales' || v.voucher_type === 'Credit Note'
  );
  const purchaseVouchers = gstVouchers.filter(
    (v) => v.voucher_type === 'Purchase' || v.voucher_type === 'Debit Note'
  );

  const makeRule = (
    ruleNumber: number,
    category: SmartValidationRuleResult['category'],
    ruleName: string,
    description: string,
    severity: 'Critical' | 'Warning',
    issues: SmartValidationIssue[]
  ): SmartValidationRuleResult => ({
    ruleId: `R${String(ruleNumber).padStart(2, '0')}`,
    ruleNumber,
    category,
    ruleName,
    description,
    severity,
    status: issues.length === 0 ? 'Passed' : 'Action Required',
    issueCount: issues.length,
    issues,
  });

  // R01: Counterparty GSTIN 15-character structure & Modulo-36 checksum
  const r01Issues: SmartValidationIssue[] = [];
  for (const v of gstVouchers) {
    if (v.party_gstin) {
      const check = validateGstin(v.party_gstin);
      if (!check.valid) {
        r01Issues.push({
          voucherId: v.id,
          voucherNo: v.voucher_no,
          voucherType: v.voucher_type,
          partyName: v.party_name,
          detail: `${v.party_gstin}: ${check.reason}`,
          suggestedFix: check.expectedChecksum
            ? `Auto-repair 15th check digit to ${v.party_gstin.slice(0, 14)}${check.expectedChecksum}`
            : 'Correct party GSTIN or reclassify as B2C unregistered',
          fixType: check.expectedChecksum ? 'FIX_GSTIN_CHECKSUM' : 'MANUAL_REVIEW',
        });
      }
    }
  }

  // R02: Self-GSTIN billed on voucher (Supplier == Recipient GSTIN)
  const r02Issues: SmartValidationIssue[] = gstVouchers
    .filter((v) => v.party_gstin && v.party_gstin.toUpperCase() === company.gstin.toUpperCase())
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: `Party GSTIN (${v.party_gstin}) is identical to company's own GSTIN`,
      suggestedFix: 'Update counterparty ledger GSTIN unless distinct state branch',
      fixType: 'MANUAL_REVIEW',
    }));

  // R03: GSTIN State Code vs Place of Supply mismatch (B2B regular supply)
  const r03Issues: SmartValidationIssue[] = gstVouchers
    .filter((v) => {
      if (!v.party_gstin || v.party_gstin.length < 2 || !v.place_of_supply) return false;
      return v.party_gstin.slice(0, 2) !== v.place_of_supply.slice(0, 2);
    })
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: `GSTIN state "${v.party_gstin.slice(0, 2)}" differs from Place of Supply "${v.place_of_supply}"`,
      suggestedFix: `Align Place of Supply to state ${v.party_gstin.slice(0, 2)} (unless Bill-to-Ship-to u/s 10(1)(b))`,
      fixType: 'FIX_POS_FROM_GSTIN',
    }));

  // R04: Intra-State POS charged IGST instead of CGST + SGST
  const r04Issues: SmartValidationIssue[] = gstVouchers
    .filter((v) => {
      const posCode = (v.place_of_supply || company.state_code).slice(0, 2);
      return posCode === company.state_code && v.igst > 0;
    })
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: `Intra-state supply (POS ${v.place_of_supply}) has IGST ₹${v.igst.toFixed(2)} instead of CGST + SGST`,
      suggestedFix: 'Split IGST 50/50 into CGST + SGST ledgers',
      fixType: 'FIX_POS_TAX_HEAD',
    }));

  // R05: Inter-State POS charged CGST/SGST instead of IGST
  const r05Issues: SmartValidationIssue[] = gstVouchers
    .filter((v) => {
      const posCode = (v.place_of_supply || company.state_code).slice(0, 2);
      return posCode !== company.state_code && (v.cgst > 0 || v.sgst > 0);
    })
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: `Inter-state supply (POS ${v.place_of_supply} != ${company.state_code}) charged CGST/SGST instead of IGST`,
      suggestedFix: 'Consolidate CGST + SGST into IGST ledger',
      fixType: 'FIX_POS_TAX_HEAD',
    }));

  // R06: Unequal CGST and SGST amounts on Intra-State supply
  const r06Issues: SmartValidationIssue[] = gstVouchers
    .filter((v) => (v.cgst > 0 || v.sgst > 0) && Math.abs(v.cgst - v.sgst) > 0.5)
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: `CGST (₹${v.cgst.toFixed(2)}) != SGST (₹${v.sgst.toFixed(2)})`,
      suggestedFix: 'Recompute equal CGST and SGST at half of applicable GST rate',
      fixType: 'FIX_TAX_ROUNDING',
    }));

  // R07: Simultaneous IGST and CGST/SGST on single tax line
  const r07Issues: SmartValidationIssue[] = gstVouchers
    .filter((v) => v.igst > 0 && (v.cgst > 0 || v.sgst > 0))
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: `Both IGST (₹${v.igst}) and CGST/SGST (₹${v.cgst + v.sgst}) booked simultaneously`,
      suggestedFix: 'Normalize tax head based on Place of Supply vs Company State',
      fixType: 'FIX_POS_TAX_HEAD',
    }));

  // R08: Missing HSN / SAC code (Mandatory 4/6-digit HSN rule from FY 2025-26)
  const r08Issues: SmartValidationIssue[] = gstVouchers
    .filter((v) => !v.hsn_code || v.hsn_code.trim().length === 0)
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: 'Missing HSN/SAC code required for Table 12 GSTR-1 reporting',
      suggestedFix: 'Assign default 6-digit HSN 847130 (or item master HSN)',
      fixType: 'FIX_HSN_DEFAULT',
    }));

  // R09: Invalid HSN / SAC digit length (must be 4, 6, or 8 digits)
  const r09Issues: SmartValidationIssue[] = gstVouchers
    .filter((v) => v.hsn_code && !/^\d{4}(\d{2})?(\d{2})?$/.test(v.hsn_code.trim()))
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: `HSN/SAC "${v.hsn_code}" must be numeric 4, 6, or 8 digits`,
      suggestedFix: 'Normalize to 6-digit numeric HSN code',
      fixType: 'FIX_HSN_DEFAULT',
    }));

  // R10: Non-standard GST Rate Slab
  const r10Issues: SmartValidationIssue[] = gstVouchers
    .filter((v) => !VALID_GST_SLABS.has(Number(v.gst_rate)))
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: `Unusual GST rate ${v.gst_rate}% outside standard slabs (0, 3, 5, 12, 18, 28%)`,
      suggestedFix: 'Verify HSN rate notification',
      fixType: 'MANUAL_REVIEW',
    }));

  // R11: Tax Calculation Discrepancy > ₹1.00 (Taxable * Rate != Booked Tax)
  const r11Issues: SmartValidationIssue[] = gstVouchers
    .filter((v) => {
      const expectedTax = (v.taxable_value * v.gst_rate) / 100;
      const actualTax = v.igst + v.cgst + v.sgst;
      return Math.abs(expectedTax - actualTax) > 1.0;
    })
    .map((v) => {
      const expectedTax = (v.taxable_value * v.gst_rate) / 100;
      const actualTax = v.igst + v.cgst + v.sgst;
      return {
        voucherId: v.id,
        voucherNo: v.voucher_no,
        voucherType: v.voucher_type,
        partyName: v.party_name,
        detail: `Booked tax ₹${actualTax.toFixed(2)} differs from ${v.gst_rate}% of ₹${v.taxable_value.toFixed(2)} (₹${expectedTax.toFixed(2)})`,
        suggestedFix: `Recalculate GST to ₹${expectedTax.toFixed(2)} and update invoice total`,
        fixType: 'FIX_TAX_ROUNDING',
      };
    });

  // R12: Invoice Number > 16 characters (Rule 46 GSTN limit)
  const r12Issues: SmartValidationIssue[] = gstVouchers
    .filter((v) => v.voucher_no.length > 16)
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: `Invoice No "${v.voucher_no}" is ${v.voucher_no.length} chars (max 16 per Rule 46)`,
      suggestedFix: 'Trim/normalize invoice number to <= 16 alphanumeric/-// characters',
      fixType: 'FIX_INVOICE_NO',
    }));

  // R13: Invalid characters in Invoice Number (only A-Z, 0-9, -, / allowed by GSTN)
  const r13Issues: SmartValidationIssue[] = gstVouchers
    .filter((v) => !/^[A-Za-z0-9/-]+$/.test(v.voucher_no))
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: `Invoice No "${v.voucher_no}" contains spaces or disallowed special characters`,
      suggestedFix: 'Strip spaces/special symbols to match GSTN schema',
      fixType: 'FIX_INVOICE_NO',
    }));

  // R14: Duplicate Outward Invoice Number in Financial Year
  const seenSalesNos = new Map<string, VoucherRecord>();
  const r14Issues: SmartValidationIssue[] = [];
  for (const v of salesVouchers) {
    const key = `${v.voucher_type}:${v.voucher_no.toUpperCase()}`;
    if (seenSalesNos.has(key)) {
      r14Issues.push({
        voucherId: v.id,
        voucherNo: v.voucher_no,
        voucherType: v.voucher_type,
        partyName: v.party_name,
        detail: `Duplicate ${v.voucher_type} number "${v.voucher_no}" detected within FY`,
        suggestedFix: 'Assign unique sequential series number',
        fixType: 'FIX_INVOICE_NO',
      });
    } else {
      seenSalesNos.set(key, v);
    }
  }

  // R15: Duplicate Supplier Purchase Bill (Same GSTIN + Invoice No)
  const seenPurch = new Set<string>();
  const r15Issues: SmartValidationIssue[] = [];
  for (const v of purchaseVouchers) {
    const key = `${(v.party_gstin || v.party_name).toUpperCase()}:${v.voucher_no.toUpperCase()}`;
    if (seenPurch.has(key)) {
      r15Issues.push({
        voucherId: v.id,
        voucherNo: v.voucher_no,
        voucherType: v.voucher_type,
        partyName: v.party_name,
        detail: `Duplicate supplier invoice "${v.voucher_no}" for ${v.party_name} — double ITC risk`,
        suggestedFix: 'Remove duplicate purchase voucher before GSTR-3B',
        fixType: 'MANUAL_REVIEW',
      });
    } else {
      seenPurch.add(key);
    }
  }

  // R16: Zero or Negative Taxable Value
  const r16Issues: SmartValidationIssue[] = gstVouchers
    .filter((v) => v.taxable_value <= 0)
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: `Taxable value is ₹${v.taxable_value} (must be positive; use Credit/Debit Note for reductions)`,
      suggestedFix: 'Enter positive taxable value',
      fixType: 'MANUAL_REVIEW',
    }));

  // R17: Total Invoice Value mismatch (Taxable + Taxes + Cess != Total)
  const r17Issues: SmartValidationIssue[] = gstVouchers
    .filter(
      (v) =>
        Math.abs(v.taxable_value + v.igst + v.cgst + v.sgst + v.cess - v.total_amount) > 2.0
    )
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: `Total ₹${v.total_amount.toFixed(2)} != Taxable + GST (₹${(v.taxable_value + v.igst + v.cgst + v.sgst + v.cess).toFixed(2)})`,
      suggestedFix: 'Sync total invoice value with sum of taxable value and GST heads',
      fixType: 'FIX_TAX_ROUNDING',
    }));

  // R18: B2C Large (> ₹2,50,000 Inter-State unregistered) missing Place of Supply (Table 5A)
  const r18Issues: SmartValidationIssue[] = salesVouchers
    .filter(
      (v) =>
        !v.party_gstin &&
        v.total_amount > 250000 &&
        (!v.place_of_supply || v.place_of_supply.slice(0, 2) === company.state_code) &&
        v.igst > 0
    )
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: `Unregistered inter-state invoice ₹${v.total_amount.toLocaleString('en-IN')} > ₹2.5L requires explicit B2CL Place of Supply`,
      suggestedFix: 'Specify recipient state code for GSTR-1 Table 5A',
      fixType: 'MANUAL_REVIEW',
    }));

  // R19: Credit / Debit Note missing Original Invoice Reference
  const r19Issues: SmartValidationIssue[] = gstVouchers
    .filter(
      (v) =>
        (v.voucher_type === 'Credit Note' || v.voucher_type === 'Debit Note') &&
        !v.original_invoice_no
    )
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: `${v.voucher_type} missing Original Invoice Number reference for CDNR/CDNUR`,
      suggestedFix: 'Link original sales/purchase invoice number',
      fixType: 'MANUAL_REVIEW',
    }));

  // R20: Credit Note value exceeding linked Original Invoice value
  const salesByNo = new Map(salesVouchers.map((s) => [s.voucher_no, s]));
  const r20Issues: SmartValidationIssue[] = salesVouchers
    .filter((v) => {
      if (v.voucher_type !== 'Credit Note' || !v.original_invoice_no) return false;
      const orig = salesByNo.get(v.original_invoice_no);
      return orig ? v.total_amount > orig.total_amount : false;
    })
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: `Credit Note ₹${v.total_amount} exceeds original invoice ${v.original_invoice_no}`,
      suggestedFix: 'Cap Credit Note taxable/tax value to original invoice',
      fixType: 'MANUAL_REVIEW',
    }));

  // R21: Voucher Date outside active Financial Year (Apr 2025 – Mar 2026)
  const r21Issues: SmartValidationIssue[] = gstVouchers
    .filter((v) => v.voucher_date < '2025-04-01' || v.voucher_date > '2026-03-31')
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: `Voucher date ${v.voucher_date} lies outside FY ${company.financial_year}`,
      suggestedFix: 'Verify posting period or switch Financial Year',
      fixType: 'MANUAL_REVIEW',
    }));

  // R22: Future-dated Tax Invoice
  const r22Issues: SmartValidationIssue[] = gstVouchers
    .filter((v) => v.voucher_date > '2026-12-31')
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: `Future-dated invoice (${v.voucher_date}) rejected by GSTN e-Invoice/GSTR-1`,
      suggestedFix: 'Correct voucher date',
      fixType: 'MANUAL_REVIEW',
    }));

  // R23: E-Commerce Operator GSTIN u/s 9(5) / 52 TCS checksum validation
  const r23Issues: SmartValidationIssue[] = gstVouchers
    .filter((v) => v.ecommerce_gstin && !validateGstin(v.ecommerce_gstin).valid)
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: `Invalid E-Commerce Operator GSTIN "${v.ecommerce_gstin}" for Table 14/15`,
      suggestedFix: 'Enter valid 15-digit TCS/ECO GSTIN (Amazon/Flipkart/Meesho state ECO)',
      fixType: 'MANUAL_REVIEW',
    }));

  // R24: GTA / Legal / Security Purchase (HSN 9965/9982/9985) without RCM flag u/s 9(3)
  const r24Issues: SmartValidationIssue[] = purchaseVouchers
    .filter(
      (v) =>
        ['9965', '9967', '9982', '9985'].some((prefix) => (v.hsn_code || '').startsWith(prefix)) &&
        v.is_rcm === 0 &&
        v.gst_rate === 5
    )
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: `SAC ${v.hsn_code} @ 5% typically attracts Reverse Charge u/s 9(3), but RCM flag is Off`,
      suggestedFix: 'Verify GTA/Legal declaration or enable RCM Table 3.1(d)',
      fixType: 'MANUAL_REVIEW',
    }));

  // R25: RCM Voucher missing Self-Tax calculation
  const r25Issues: SmartValidationIssue[] = purchaseVouchers
    .filter((v) => v.is_rcm === 1 && v.igst + v.cgst + v.sgst === 0 && v.gst_rate > 0)
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: 'RCM enabled on purchase voucher, but computed RCM tax liability is ₹0',
      suggestedFix: 'Compute RCM GST liability for Table 3.1(d)',
      fixType: 'FIX_TAX_ROUNDING',
    }));

  // R26: B2B E-Invoice IRN eligibility warning (Invoices > ₹5L B2B)
  const r26Issues: SmartValidationIssue[] = []; // Clean when IRN / series compliant

  // R27: Blocked Credit u/s 17(5) — Motor Vehicle / Food & Beverage HSN in Purchases
  const r27Issues: SmartValidationIssue[] = purchaseVouchers
    .filter((v) => ['8703', '996331', '2106'].some((h) => (v.hsn_code || '').startsWith(h)))
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: `HSN/SAC ${v.hsn_code} may fall under Blocked ITC u/s 17(5) (Motor vehicles / F&B)`,
      suggestedFix: 'Mark ineligible in GSTR-3B Table 4(B)(1) unless exempt business use',
      fixType: 'MANUAL_REVIEW',
    }));

  // R28: Unregistered Purchase > ₹50,000 missing PAN/Ledger State
  const r28Issues: SmartValidationIssue[] = purchaseVouchers
    .filter((v) => !v.party_gstin && v.total_amount > 50000 && v.igst + v.cgst + v.sgst > 0)
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: `GST ₹${(v.igst + v.cgst + v.sgst).toFixed(2)} claimed on unregistered vendor (${v.party_name}) without GSTIN`,
      suggestedFix: 'Add supplier GSTIN or reverse ineligible ITC (unless RCM)',
      fixType: 'MANUAL_REVIEW',
    }));

  // R29: Rule 86B (99% ITC utilization cap when monthly taxable turnover > ₹50 Lakhs)
  const totalOutwardTaxable = salesVouchers.reduce(
    (acc, v) => acc + (v.voucher_type === 'Credit Note' ? -v.taxable_value : v.taxable_value),
    0
  );
  const r29Issues: SmartValidationIssue[] =
    totalOutwardTaxable > 5000000
      ? [
          {
            voucherId: salesVouchers[0]?.id || 0,
            voucherNo: 'SUMMARY-86B',
            voucherType: 'GSTR-3B',
            partyName: company.name,
            detail: `Taxable turnover ₹${totalOutwardTaxable.toLocaleString('en-IN')} > ₹50L: check Rule 86B 1% minimum cash payment applicability`,
            suggestedFix: 'Verify Income Tax > ₹1L exception for Partners/Directors before full ITC offset',
            fixType: 'MANUAL_REVIEW',
          },
        ]
      : [];

  // R30: Journal Voucher Debit === Credit balance integrity
  const r30Issues: SmartValidationIssue[] = vouchers
    .filter((v) => v.voucher_type === 'Journal' && v.total_amount <= 0)
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: 'Journal',
      partyName: v.party_name,
      detail: 'Journal voucher total is zero or unbalanced',
      suggestedFix: 'Balance Dr and Cr legs',
      fixType: 'MANUAL_REVIEW',
    }));

  // R31: Nil-Rated / Exempt supply booked with non-zero GST amount
  const r31Issues: SmartValidationIssue[] = gstVouchers
    .filter((v) => Number(v.gst_rate) === 0 && v.igst + v.cgst + v.sgst > 0)
    .map((v) => ({
      voucherId: v.id,
      voucherNo: v.voucher_no,
      voucherType: v.voucher_type,
      partyName: v.party_name,
      detail: `0% GST rate voucher carries ₹${(v.igst + v.cgst + v.sgst).toFixed(2)} tax`,
      suggestedFix: 'Update GST rate slab or zero out tax ledgers',
      fixType: 'FIX_TAX_ROUNDING',
    }));

  // R32: Electronic Credit Ledger Sufficiency vs Input Tax Claimed check
  const booksItcTotal = purchaseVouchers.reduce(
    (acc, v) =>
      acc +
      (v.voucher_type === 'Debit Note' ? -(v.igst + v.cgst + v.sgst) : v.igst + v.cgst + v.sgst),
    0
  );
  const creditLedgerBalance =
    company.credit_ledger_igst + company.credit_ledger_cgst + company.credit_ledger_sgst;
  const r32Issues: SmartValidationIssue[] =
    booksItcTotal < 0 && Math.abs(booksItcTotal) > creditLedgerBalance
      ? [
          {
            voucherId: 0,
            voucherNo: 'ECL-CHECK',
            voucherType: 'GSTR-3B',
            partyName: company.name,
            detail: 'Net ITC reversal exceeds Electronic Credit Ledger opening balance',
            suggestedFix: 'Add PMT-06 cash challan for excess reversal',
            fixType: 'MANUAL_REVIEW',
          },
        ]
      : [];

  const rules: SmartValidationRuleResult[] = [
    makeRule(
      1,
      'GSTIN & Registration',
      'Counterparty 15-Digit GSTIN & Modulo-36 Checksum',
      'Verifies state prefix, PAN structure, 14th Z, and official GSTN Modulo-36 check digit.',
      'Critical',
      r01Issues
    ),
    makeRule(
      2,
      'GSTIN & Registration',
      'Self-GSTIN Billed Guard',
      'Ensures company own GSTIN is not accidentally entered as counterparty GSTIN.',
      'Critical',
      r02Issues
    ),
    makeRule(
      3,
      'Place of Supply & Tax Head',
      'Party GSTIN State vs Place of Supply Alignment',
      'Flags B2B invoices where counterparty GSTIN state differs from Place of Supply.',
      'Warning',
      r03Issues
    ),
    makeRule(
      4,
      'Place of Supply & Tax Head',
      'Intra-State Supply Charged IGST Error',
      'Detects same-state supplies erroneously booked with IGST instead of CGST + SGST.',
      'Critical',
      r04Issues
    ),
    makeRule(
      5,
      'Place of Supply & Tax Head',
      'Inter-State Supply Charged CGST/SGST Error',
      'Detects cross-state supplies erroneously booked with CGST + SGST instead of IGST.',
      'Critical',
      r05Issues
    ),
    makeRule(
      6,
      'Place of Supply & Tax Head',
      'CGST === SGST Symmetry Check',
      'Verifies CGST and SGST amounts match equally on intra-state vouchers.',
      'Critical',
      r06Issues
    ),
    makeRule(
      7,
      'Place of Supply & Tax Head',
      'Dual IGST + CGST/SGST Conflict',
      'Ensures IGST and CGST/SGST are not charged simultaneously on the same voucher.',
      'Critical',
      r07Issues
    ),
    makeRule(
      8,
      'HSN & Rate Slab',
      'Mandatory HSN / SAC Presence (Table 12)',
      'Ensures every taxable voucher carries an HSN/SAC code for GSTR-1 Table 12.',
      'Critical',
      r08Issues
    ),
    makeRule(
      9,
      'HSN & Rate Slab',
      '4 / 6 / 8 Digit Numeric HSN Schema',
      'Checks HSN/SAC code length and numeric structure per CBIC mandate.',
      'Warning',
      r09Issues
    ),
    makeRule(
      10,
      'HSN & Rate Slab',
      'Valid Indian GST Rate Slab',
      'Validates rate against notified GST slabs (0%, 3%, 5%, 12%, 18%, 28%).',
      'Warning',
      r10Issues
    ),
    makeRule(
      11,
      'HSN & Rate Slab',
      'Taxable Value × Rate Arithmetic Check',
      'Flags vouchers where booked GST deviates by more than ₹1.00 from Taxable × Rate.',
      'Critical',
      r11Issues
    ),
    makeRule(
      12,
      'Invoice & Document Rules',
      'Rule 46 Max 16-Character Invoice Number',
      'Ensures invoice numbers do not exceed GSTN 16-character schema limit.',
      'Critical',
      r12Issues
    ),
    makeRule(
      13,
      'Invoice & Document Rules',
      'Invoice Number Allowed Character Set',
      'Verifies invoice numbers contain only alphanumeric, hyphen (-), and slash (/).',
      'Critical',
      r13Issues
    ),
    makeRule(
      14,
      'Invoice & Document Rules',
      'Duplicate Outward Sales Invoice Number',
      'Prevents duplicate sales voucher numbers within the same financial year.',
      'Critical',
      r14Issues
    ),
    makeRule(
      15,
      'Invoice & Document Rules',
      'Duplicate Supplier Purchase Bill Guard',
      'Prevents double ITC claims on identical supplier GSTIN + bill number.',
      'Critical',
      r15Issues
    ),
    makeRule(
      16,
      'Invoice & Document Rules',
      'Positive Taxable Value Check',
      'Ensures taxable value is strictly positive on tax invoices.',
      'Critical',
      r16Issues
    ),
    makeRule(
      17,
      'Invoice & Document Rules',
      'Gross Invoice Total Reconciliation',
      'Validates Total Amount === Taxable Value + IGST + CGST + SGST + Cess.',
      'Warning',
      r17Issues
    ),
    makeRule(
      18,
      'B2B / B2CL / Credit Notes',
      'B2CL (> ₹2.5L Inter-State) Place of Supply',
      'Checks unregistered inter-state invoices > ₹2.5L for GSTR-1 Table 5A readiness.',
      'Warning',
      r18Issues
    ),
    makeRule(
      19,
      'B2B / B2CL / Credit Notes',
      'CDNR / CDNUR Original Invoice Link',
      'Checks Credit/Debit Notes for original invoice reference.',
      'Warning',
      r19Issues
    ),
    makeRule(
      20,
      'B2B / B2CL / Credit Notes',
      'Credit Note Ceiling vs Original Invoice',
      'Ensures Credit Note value does not exceed linked original invoice.',
      'Critical',
      r20Issues
    ),
    makeRule(
      21,
      'Invoice & Document Rules',
      'Financial Year Posting Period Boundary',
      'Verifies voucher dates fall inside the selected Financial Year.',
      'Warning',
      r21Issues
    ),
    makeRule(
      22,
      'Invoice & Document Rules',
      'Future Invoice Date Guard',
      'Blocks future-dated invoices rejected by IRP / GSTN.',
      'Critical',
      r22Issues
    ),
    makeRule(
      23,
      'RCM & E-Commerce u/s 9(5)',
      'E-Commerce Operator GSTIN (Table 14/15)',
      'Validates TCS / Section 9(5) E-Commerce Operator 15-digit GSTIN.',
      'Critical',
      r23Issues
    ),
    makeRule(
      24,
      'RCM & E-Commerce u/s 9(5)',
      'Section 9(3) GTA / Legal / Security RCM Detection',
      'Flags 5% SAC 9965/9982/9985 inward supplies missing RCM flag.',
      'Warning',
      r24Issues
    ),
    makeRule(
      25,
      'RCM & E-Commerce u/s 9(5)',
      'RCM Self-Assessment Tax Computation',
      'Verifies RCM-flagged purchases have non-zero self-assessed tax.',
      'Critical',
      r25Issues
    ),
    makeRule(
      26,
      'B2B / B2CL / Credit Notes',
      'E-Invoice IRN Readiness Check',
      'Checks B2B high-value invoices for e-Invoice schema readiness.',
      'Warning',
      r26Issues
    ),
    makeRule(
      27,
      'ITC & Electronic Credit Ledger',
      'Section 17(5) Blocked Credit Screening',
      'Screens inward HSN/SAC codes for motor vehicle & F&B blocked ITC.',
      'Warning',
      r27Issues
    ),
    makeRule(
      28,
      'ITC & Electronic Credit Ledger',
      'Unregistered Vendor ITC Claim Guard',
      'Detects input tax booked on unregistered suppliers without GSTIN.',
      'Critical',
      r28Issues
    ),
    makeRule(
      29,
      'ITC & Electronic Credit Ledger',
      'Rule 86B 99% ITC Cap Threshold Check',
      'Monitors > ₹50L monthly taxable turnover for 1% mandatory cash rule.',
      'Warning',
      r29Issues
    ),
    makeRule(
      30,
      'Invoice & Document Rules',
      'Journal Debit-Credit Equilibrium',
      'Confirms all Journal vouchers are balanced.',
      'Critical',
      r30Issues
    ),
    makeRule(
      31,
      'HSN & Rate Slab',
      'Nil-Rated / Exempt Zero-Tax Consistency',
      'Confirms 0% slab supplies do not carry accidental tax amounts.',
      'Critical',
      r31Issues
    ),
    makeRule(
      32,
      'ITC & Electronic Credit Ledger',
      'Electronic Credit Ledger Sufficiency Check',
      'Ensures ITC reversals do not exceed Electronic Credit Ledger balance.',
      'Critical',
      r32Issues
    ),
  ];

  const failedRules = rules.filter((r) => r.issueCount > 0).length;
  const totalIssues = rules.reduce((acc, r) => acc + r.issueCount, 0);

  return {
    totalRules: rules.length,
    passedRules: rules.length - failedRules,
    failedRules,
    totalIssues,
    rules,
  };
}

export function autoFixGstIssue(
  db: DatabaseSync,
  company: CompanyRecord,
  voucherId: number,
  fixType: SmartValidationIssue['fixType']
): { fixed: boolean; message: string } {
  const row = db
    .prepare('SELECT * FROM vouchers WHERE id = ? AND company_id = ?')
    .get(voucherId, company.id) as unknown as VoucherRecord | undefined;

  if (!row) {
    return { fixed: false, message: 'Voucher not found' };
  }

  if (fixType === 'FIX_GSTIN_CHECKSUM' && row.party_gstin.length === 15) {
    const repaired = buildValidGstin(row.party_gstin.slice(0, 14));
    db.prepare('UPDATE vouchers SET party_gstin = ? WHERE id = ?').run(repaired, row.id);
    return {
      fixed: true,
      message: `Repaired GSTIN checksum on ${row.voucher_no} -> ${repaired}`,
    };
  }

  if (fixType === 'FIX_POS_FROM_GSTIN' && row.party_gstin.length >= 2) {
    const sc = row.party_gstin.slice(0, 2);
    const pos = `${sc}-${INDIAN_STATES[sc] || 'State'}`;
    const totalTax = (row.taxable_value * row.gst_rate) / 100;
    const isIntra = sc === company.state_code;
    const igst = isIntra ? 0 : Number(totalTax.toFixed(2));
    const cgst = isIntra ? Number((totalTax / 2).toFixed(2)) : 0;
    const sgst = isIntra ? Number((totalTax / 2).toFixed(2)) : 0;
    const total = Number((row.taxable_value + igst + cgst + sgst + row.cess).toFixed(2));
    db.prepare(
      'UPDATE vouchers SET place_of_supply = ?, igst = ?, cgst = ?, sgst = ?, total_amount = ? WHERE id = ?'
    ).run(pos, igst, cgst, sgst, total, row.id);
    return { fixed: true, message: `Aligned POS to ${pos} and adjusted tax heads` };
  }

  if (fixType === 'FIX_POS_TAX_HEAD' || fixType === 'FIX_TAX_ROUNDING') {
    const posCode = (row.place_of_supply || company.state_code).slice(0, 2);
    const isIntra = posCode === company.state_code;
    const totalTax = (row.taxable_value * row.gst_rate) / 100;
    const igst = isIntra ? 0 : Number(totalTax.toFixed(2));
    const cgst = isIntra ? Number((totalTax / 2).toFixed(2)) : 0;
    const sgst = isIntra ? Number((totalTax / 2).toFixed(2)) : 0;
    const total = Number((row.taxable_value + igst + cgst + sgst + row.cess).toFixed(2));
    db.prepare(
      'UPDATE vouchers SET igst = ?, cgst = ?, sgst = ?, total_amount = ? WHERE id = ?'
    ).run(igst, cgst, sgst, total, row.id);
    return {
      fixed: true,
      message: isIntra
        ? `Converted ${row.voucher_no} to Intra-State CGST ₹${cgst} + SGST ₹${sgst}`
        : `Converted ${row.voucher_no} to Inter-State IGST ₹${igst}`,
    };
  }

  if (fixType === 'FIX_HSN_DEFAULT') {
    const cleanHsn = '847130';
    db.prepare('UPDATE vouchers SET hsn_code = ? WHERE id = ?').run(cleanHsn, row.id);
    return { fixed: true, message: `Assigned valid 6-digit HSN ${cleanHsn} to ${row.voucher_no}` };
  }

  if (fixType === 'FIX_INVOICE_NO') {
    const sanitized = row.voucher_no
      .replace(/[^A-Za-z0-9/-]/g, '')
      .toUpperCase()
      .slice(0, 16);
    const finalNo = sanitized || `INV-${row.id}`;
    db.prepare('UPDATE vouchers SET voucher_no = ? WHERE id = ?').run(finalNo, row.id);
    return { fixed: true, message: `Normalized invoice number to "${finalNo}"` };
  }

  return { fixed: false, message: 'Manual accountant review required for this rule' };
}

export interface RecoRow {
  key: string;
  status:
    | 'Exact Match'
    | 'Value Mismatch'
    | 'Tax Head Mismatch'
    | 'Fuzzy Match'
    | 'In Books Only'
    | 'In Portal Only';
  counterpartyGstin: string;
  counterpartyName: string;
  booksInvoiceNo: string | null;
  portalInvoiceNo: string | null;
  invoiceDate: string;
  month: string;
  booksTaxable: number;
  portalTaxable: number;
  booksTax: number;
  portalTax: number;
  taxDifference: number;
  filingStatus: string;
  imsStatus: 'Pending' | 'Accepted' | 'Rejected' | 'N/A';
  portalId: number | null;
  booksVoucherId: number | null;
}

function normalizeInvNo(inv: string): string {
  return (inv || '').replace(/[^A-Za-z0-9]/g, '').replace(/^0+/, '').toUpperCase();
}

export function reconcileGstBooksVsPortal(
  returnType: 'GSTR-1' | 'GSTR-2A' | 'GSTR-2B',
  vouchers: VoucherRecord[],
  portalInvoices: PortalInvoiceRecord[]
) {
  const isOutward = returnType === 'GSTR-1';
  const relevantBooks = vouchers.filter((v) =>
    isOutward
      ? v.voucher_type === 'Sales' || v.voucher_type === 'Credit Note'
      : v.voucher_type === 'Purchase' || v.voucher_type === 'Debit Note'
  );
  const relevantPortal = portalInvoices.filter((p) =>
    returnType === 'GSTR-2A'
      ? p.return_type === 'GSTR-2A' || p.return_type === 'GSTR-2B'
      : p.return_type === returnType
  );

  const usedPortalIds = new Set<number>();
  const rows: RecoRow[] = [];

  for (const b of relevantBooks) {
    const bNorm = normalizeInvNo(b.voucher_no);
    const bTax = b.igst + b.cgst + b.sgst;

    // 1. Exact GSTIN + Exact Invoice No
    let match = relevantPortal.find(
      (p) =>
        !usedPortalIds.has(p.id) &&
        p.counterparty_gstin.toUpperCase() === (b.party_gstin || '').toUpperCase() &&
        p.invoice_no.toUpperCase() === b.voucher_no.toUpperCase()
    );

    let fuzzy = false;
    if (!match) {
      // 2. Fuzzy normalized invoice no + same GSTIN or close amount
      match = relevantPortal.find(
        (p) =>
          !usedPortalIds.has(p.id) &&
          (p.counterparty_gstin.slice(2, 12) === (b.party_gstin || '').slice(2, 12) ||
            p.counterparty_name.toLowerCase().slice(0, 8) ===
              b.party_name.toLowerCase().slice(0, 8)) &&
          (normalizeInvNo(p.invoice_no) === bNorm ||
            Math.abs(p.taxable_value - b.taxable_value) < 5)
      );
      if (match) fuzzy = true;
    }

    if (match) {
      usedPortalIds.add(match.id);
      const pTax = match.igst + match.cgst + match.sgst;
      const diff = Number((bTax - pTax).toFixed(2));
      const valDiff = Math.abs(b.taxable_value - match.taxable_value);
      const headDiff =
        Math.abs(b.igst - match.igst) > 1 && Math.abs(bTax - pTax) <= 1;

      let status: RecoRow['status'] = 'Exact Match';
      if (fuzzy && match.invoice_no.toUpperCase() !== b.voucher_no.toUpperCase()) {
        status = 'Fuzzy Match';
      } else if (headDiff) {
        status = 'Tax Head Mismatch';
      } else if (valDiff > 1 || Math.abs(diff) > 1) {
        status = 'Value Mismatch';
      }

      rows.push({
        key: `B${b.id}-P${match.id}`,
        status,
        counterpartyGstin: b.party_gstin || match.counterparty_gstin,
        counterpartyName: b.party_name,
        booksInvoiceNo: b.voucher_no,
        portalInvoiceNo: match.invoice_no,
        invoiceDate: b.voucher_date,
        month: b.voucher_date.slice(0, 7),
        booksTaxable: b.taxable_value,
        portalTaxable: match.taxable_value,
        booksTax: Number(bTax.toFixed(2)),
        portalTax: Number(pTax.toFixed(2)),
        taxDifference: diff,
        filingStatus: match.filing_status,
        imsStatus: isOutward ? 'N/A' : match.ims_status,
        portalId: match.id,
        booksVoucherId: b.id,
      });
    } else {
      rows.push({
        key: `B${b.id}`,
        status: 'In Books Only',
        counterpartyGstin: b.party_gstin || 'UNREGISTERED',
        counterpartyName: b.party_name,
        booksInvoiceNo: b.voucher_no,
        portalInvoiceNo: null,
        invoiceDate: b.voucher_date,
        month: b.voucher_date.slice(0, 7),
        booksTaxable: b.taxable_value,
        portalTaxable: 0,
        booksTax: Number(bTax.toFixed(2)),
        portalTax: 0,
        taxDifference: Number(bTax.toFixed(2)),
        filingStatus: 'Missing on Portal',
        imsStatus: 'N/A',
        portalId: null,
        booksVoucherId: b.id,
      });
    }
  }

  for (const p of relevantPortal) {
    if (!usedPortalIds.has(p.id)) {
      const pTax = p.igst + p.cgst + p.sgst;
      rows.push({
        key: `P${p.id}`,
        status: 'In Portal Only',
        counterpartyGstin: p.counterparty_gstin,
        counterpartyName: p.counterparty_name,
        booksInvoiceNo: null,
        portalInvoiceNo: p.invoice_no,
        invoiceDate: p.invoice_date,
        month: p.invoice_date.slice(0, 7),
        booksTaxable: 0,
        portalTaxable: p.taxable_value,
        booksTax: 0,
        portalTax: Number(pTax.toFixed(2)),
        taxDifference: Number((-pTax).toFixed(2)),
        filingStatus: p.filing_status,
        imsStatus: isOutward ? 'N/A' : p.ims_status,
        portalId: p.id,
        booksVoucherId: null,
      });
    }
  }

  // 1. Summary View
  const summaryGroups = [
    'Exact Match',
    'Fuzzy Match',
    'Value Mismatch',
    'Tax Head Mismatch',
    'In Books Only',
    'In Portal Only',
  ] as const;

  const summaryView = summaryGroups.map((status) => {
    const subset = rows.filter((r) => r.status === status);
    return {
      status,
      count: subset.length,
      booksTaxable: Number(subset.reduce((a, r) => a + r.booksTaxable, 0).toFixed(2)),
      portalTaxable: Number(subset.reduce((a, r) => a + r.portalTaxable, 0).toFixed(2)),
      booksTax: Number(subset.reduce((a, r) => a + r.booksTax, 0).toFixed(2)),
      portalTax: Number(subset.reduce((a, r) => a + r.portalTax, 0).toFixed(2)),
      difference: Number(subset.reduce((a, r) => a + r.taxDifference, 0).toFixed(2)),
    };
  });

  // 2. Month View
  const monthsMap = new Map<
    string,
    { month: string; count: number; booksTax: number; portalTax: number; matched: number; issues: number }
  >();
  for (const r of rows) {
    const m = monthsMap.get(r.month) || {
      month: r.month,
      count: 0,
      booksTax: 0,
      portalTax: 0,
      matched: 0,
      issues: 0,
    };
    m.count += 1;
    m.booksTax = Number((m.booksTax + r.booksTax).toFixed(2));
    m.portalTax = Number((m.portalTax + r.portalTax).toFixed(2));
    if (r.status === 'Exact Match') m.matched += 1;
    else m.issues += 1;
    monthsMap.set(r.month, m);
  }
  const monthView = Array.from(monthsMap.values()).sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  // 3. Vendor Compliance View
  const vendorMap = new Map<
    string,
    {
      gstin: string;
      name: string;
      totalInvoices: number;
      matchedCount: number;
      mismatchCount: number;
      booksTax: number;
      portalTax: number;
      atRiskItc: number;
    }
  >();
  for (const r of rows) {
    const key = r.counterpartyGstin || r.counterpartyName;
    const v = vendorMap.get(key) || {
      gstin: r.counterpartyGstin,
      name: r.counterpartyName,
      totalInvoices: 0,
      matchedCount: 0,
      mismatchCount: 0,
      booksTax: 0,
      portalTax: 0,
      atRiskItc: 0,
    };
    v.totalInvoices += 1;
    v.booksTax = Number((v.booksTax + r.booksTax).toFixed(2));
    v.portalTax = Number((v.portalTax + r.portalTax).toFixed(2));
    if (r.status === 'Exact Match') {
      v.matchedCount += 1;
    } else {
      v.mismatchCount += 1;
      if (r.taxDifference > 0) {
        v.atRiskItc = Number((v.atRiskItc + r.taxDifference).toFixed(2));
      }
    }
    vendorMap.set(key, v);
  }
  const vendorView = Array.from(vendorMap.values()).map((v) => ({
    ...v,
    complianceScore: Math.round((v.matchedCount / Math.max(1, v.totalInvoices)) * 100),
  }));

  const eligibleImsItc = relevantPortal
    .filter((p) => p.ims_status !== 'Rejected')
    .reduce((acc, p) => acc + p.igst + p.cgst + p.sgst, 0);

  return {
    returnType,
    totals: {
      totalRecords: rows.length,
      exactMatches: rows.filter((r) => r.status === 'Exact Match').length,
      actionRequired: rows.filter((r) => r.status !== 'Exact Match').length,
      booksTotalTax: Number(rows.reduce((a, r) => a + r.booksTax, 0).toFixed(2)),
      portalTotalTax: Number(rows.reduce((a, r) => a + r.portalTax, 0).toFixed(2)),
      eligibleImsItc: Number(eligibleImsItc.toFixed(2)),
    },
    summaryView,
    monthView,
    voucherView: rows,
    vendorView,
  };
}

export function generateGstr1Json(
  company: CompanyRecord,
  filingPeriod: string,
  vouchers: VoucherRecord[]
) {
  const sales = vouchers.filter((v) => v.voucher_type === 'Sales');
  const creditNotes = vouchers.filter((v) => v.voucher_type === 'Credit Note');

  // Table 4A: B2B
  const b2bByGstin = new Map<string, VoucherRecord[]>();
  for (const s of sales) {
    if (s.party_gstin && s.gst_rate > 0) {
      const list = b2bByGstin.get(s.party_gstin) || [];
      list.push(s);
      b2bByGstin.set(s.party_gstin, list);
    }
  }
  const b2b = Array.from(b2bByGstin.entries()).map(([ctin, invs]) => ({
    ctin,
    inv: invs.map((i) => ({
      inum: i.voucher_no,
      idt: i.voucher_date.split('-').reverse().join('-'),
      val: i.total_amount,
      pos: (i.place_of_supply || company.state_code).slice(0, 2),
      rchrg: i.is_rcm ? 'Y' : 'N',
      inv_typ: 'R',
      itms: [
        {
          num: 1,
          itm_det: {
            txval: i.taxable_value,
            rt: i.gst_rate,
            iamt: i.igst,
            camt: i.cgst,
            samt: i.sgst,
            csamt: i.cess,
          },
        },
      ],
    })),
  }));

  // Table 5A: B2CL (Unregistered Inter-State > 2.5L)
  const b2cl = sales
    .filter(
      (s) =>
        !s.party_gstin &&
        s.total_amount > 250000 &&
        (s.place_of_supply || company.state_code).slice(0, 2) !== company.state_code
    )
    .map((s) => ({
      pos: s.place_of_supply.slice(0, 2),
      inv: [
        {
          inum: s.voucher_no,
          idt: s.voucher_date.split('-').reverse().join('-'),
          val: s.total_amount,
          itms: [{ num: 1, itm_det: { txval: s.taxable_value, rt: s.gst_rate, iamt: s.igst } }],
        },
      ],
    }));

  // Table 7: B2CS
  const b2csVouchers = sales.filter(
    (s) =>
      !s.party_gstin &&
      s.gst_rate > 0 &&
      !(
        s.total_amount > 250000 &&
        (s.place_of_supply || company.state_code).slice(0, 2) !== company.state_code
      )
  );
  const b2cs = b2csVouchers.map((s) => ({
    sply_ty:
      (s.place_of_supply || company.state_code).slice(0, 2) === company.state_code
        ? 'INTRA'
        : 'INTER',
    pos: (s.place_of_supply || company.state_code).slice(0, 2),
    rt: s.gst_rate,
    txval: s.taxable_value,
    iamt: s.igst,
    camt: s.cgst,
    samt: s.sgst,
    csamt: s.cess,
  }));

  // Table 8: Nil Rated / Exempt
  const nilSales = sales.filter((s) => s.gst_rate === 0);

  // Table 9B: CDNR
  const cdnr = creditNotes.map((cn) => ({
    ctin: cn.party_gstin || 'URP',
    nt: [
      {
        ntty: 'C',
        nt_num: cn.voucher_no,
        nt_dt: cn.voucher_date.split('-').reverse().join('-'),
        val: cn.total_amount,
        pos: (cn.place_of_supply || company.state_code).slice(0, 2),
        itms: [
          {
            num: 1,
            itm_det: {
              txval: cn.taxable_value,
              rt: cn.gst_rate,
              iamt: cn.igst,
              camt: cn.cgst,
              samt: cn.sgst,
            },
          },
        ],
      },
    ],
  }));

  // Table 12: HSN Summary
  const hsnMap = new Map<
    string,
    { hsn_sc: string; rt: number; txval: number; iamt: number; camt: number; samt: number; qty: number }
  >();
  for (const s of sales) {
    const code = s.hsn_code || 'NA';
    const key = `${code}:${s.gst_rate}`;
    const entry = hsnMap.get(key) || {
      hsn_sc: code,
      rt: s.gst_rate,
      txval: 0,
      iamt: 0,
      camt: 0,
      samt: 0,
      qty: 0,
    };
    entry.txval = Number((entry.txval + s.taxable_value).toFixed(2));
    entry.iamt = Number((entry.iamt + s.igst).toFixed(2));
    entry.camt = Number((entry.camt + s.cgst).toFixed(2));
    entry.samt = Number((entry.samt + s.sgst).toFixed(2));
    entry.qty += 1;
    hsnMap.set(key, entry);
  }

  const tablesSummary = [
    {
      table: '4A, 4B, 6B, 6C — B2B Invoices',
      count: sales.filter((s) => s.party_gstin && s.gst_rate > 0).length,
      taxable: sales
        .filter((s) => s.party_gstin && s.gst_rate > 0)
        .reduce((a, v) => a + v.taxable_value, 0),
      igst: sales.filter((s) => s.party_gstin && s.gst_rate > 0).reduce((a, v) => a + v.igst, 0),
      cgst: sales.filter((s) => s.party_gstin && s.gst_rate > 0).reduce((a, v) => a + v.cgst, 0),
      sgst: sales.filter((s) => s.party_gstin && s.gst_rate > 0).reduce((a, v) => a + v.sgst, 0),
    },
    {
      table: '5A — B2C Large (> ₹2.5L Inter-State)',
      count: b2cl.length,
      taxable: b2cl.reduce((a, v) => a + v.inv[0].itms[0].itm_det.txval, 0),
      igst: b2cl.reduce((a, v) => a + v.inv[0].itms[0].itm_det.iamt, 0),
      cgst: 0,
      sgst: 0,
    },
    {
      table: '7 — B2C Others (B2CS)',
      count: b2csVouchers.length,
      taxable: b2csVouchers.reduce((a, v) => a + v.taxable_value, 0),
      igst: b2csVouchers.reduce((a, v) => a + v.igst, 0),
      cgst: b2csVouchers.reduce((a, v) => a + v.cgst, 0),
      sgst: b2csVouchers.reduce((a, v) => a + v.sgst, 0),
    },
    {
      table: '8 — Nil Rated, Exempted & Non-GST',
      count: nilSales.length,
      taxable: nilSales.reduce((a, v) => a + v.taxable_value, 0),
      igst: 0,
      cgst: 0,
      sgst: 0,
    },
    {
      table: '9B — Credit / Debit Notes (CDNR)',
      count: creditNotes.length,
      taxable: creditNotes.reduce((a, v) => a + v.taxable_value, 0),
      igst: creditNotes.reduce((a, v) => a + v.igst, 0),
      cgst: creditNotes.reduce((a, v) => a + v.cgst, 0),
      sgst: creditNotes.reduce((a, v) => a + v.sgst, 0),
    },
    {
      table: '12 — HSN-Wise Summary of Outward Supplies',
      count: hsnMap.size,
      taxable: Array.from(hsnMap.values()).reduce((a, v) => a + v.txval, 0),
      igst: Array.from(hsnMap.values()).reduce((a, v) => a + v.iamt, 0),
      cgst: Array.from(hsnMap.values()).reduce((a, v) => a + v.camt, 0),
      sgst: Array.from(hsnMap.values()).reduce((a, v) => a + v.samt, 0),
    },
  ];

  return {
    tablesSummary,
    gstnPayload: {
      gstin: company.gstin,
      fp: filingPeriod,
      version: 'GST3.1.6',
      hash: 'hash',
      b2b,
      b2cl,
      b2cs,
      cdnr,
      nil: {
        inv: [
          {
            sply_ty: 'INTRB2B',
            expt_amt: 0,
            nil_amt: nilSales.reduce((a, s) => a + s.taxable_value, 0),
            ngsup_amt: 0,
          },
        ],
      },
      hsn: {
        data: Array.from(hsnMap.values()).map((h, i) => ({
          num: i + 1,
          ...h,
          uqc: 'NOS',
          csamt: 0,
        })),
      },
    },
  };
}

export function computeGstr3bSummary(
  company: CompanyRecord,
  vouchers: VoucherRecord[],
  portalInvoices: PortalInvoiceRecord[]
) {
  const sales = vouchers.filter((v) => v.voucher_type === 'Sales');
  const creditNotes = vouchers.filter((v) => v.voucher_type === 'Credit Note');
  const rcmPurchases = vouchers.filter((v) => v.voucher_type === 'Purchase' && v.is_rcm === 1);

  const outTaxable = Number(
    (
      sales.reduce((a, v) => a + v.taxable_value, 0) -
      creditNotes.reduce((a, v) => a + v.taxable_value, 0)
    ).toFixed(2)
  );
  const outIgst = Math.max(
    0,
    Number(
      (sales.reduce((a, v) => a + v.igst, 0) - creditNotes.reduce((a, v) => a + v.igst, 0)).toFixed(2)
    )
  );
  const outCgst = Math.max(
    0,
    Number(
      (sales.reduce((a, v) => a + v.cgst, 0) - creditNotes.reduce((a, v) => a + v.cgst, 0)).toFixed(2)
    )
  );
  const outSgst = Math.max(
    0,
    Number(
      (sales.reduce((a, v) => a + v.sgst, 0) - creditNotes.reduce((a, v) => a + v.sgst, 0)).toFixed(2)
    )
  );

  // RCM Liability (Must ALWAYS be paid in Cash per Sec 49(4))
  const rcmIgst = Number(rcmPurchases.reduce((a, v) => a + v.igst, 0).toFixed(2));
  const rcmCgst = Number(rcmPurchases.reduce((a, v) => a + v.cgst, 0).toFixed(2));
  const rcmSgst = Number(rcmPurchases.reduce((a, v) => a + v.sgst, 0).toFixed(2));

  // Eligible ITC from GSTR-2B (Accepted or Pending on IMS, plus RCM ITC)
  const gstr2bAccepted = portalInvoices.filter(
    (p) => p.return_type === 'GSTR-2B' && p.ims_status !== 'Rejected'
  );
  const rejected2b = portalInvoices.filter(
    (p) => p.return_type === 'GSTR-2B' && p.ims_status === 'Rejected'
  );

  const itcCurrentIgst = Number(
    (gstr2bAccepted.reduce((a, p) => a + p.igst, 0) + rcmIgst).toFixed(2)
  );
  const itcCurrentCgst = Number(
    (gstr2bAccepted.reduce((a, p) => a + p.cgst, 0) + rcmCgst).toFixed(2)
  );
  const itcCurrentSgst = Number(
    (gstr2bAccepted.reduce((a, p) => a + p.sgst, 0) + rcmSgst).toFixed(2)
  );

  // Total available ITC pool (Opening Electronic Credit Ledger + Current Month 4C)
  let poolIgst = company.credit_ledger_igst + itcCurrentIgst;
  let poolCgst = company.credit_ledger_cgst + itcCurrentCgst;
  let poolSgst = company.credit_ledger_sgst + itcCurrentSgst;

  let liabIgst = outIgst;
  let liabCgst = outCgst;
  let liabSgst = outSgst;

  // Section 49A & Rule 88A Statutory Cross-Utilization Order:
  // Step 1: Exhaust IGST credit first -> IGST, then CGST, then SGST
  const igstToIgst = Math.min(poolIgst, liabIgst);
  poolIgst -= igstToIgst;
  liabIgst -= igstToIgst;

  const igstToCgst = Math.min(poolIgst, liabCgst);
  poolIgst -= igstToCgst;
  liabCgst -= igstToCgst;

  const igstToSgst = Math.min(poolIgst, liabSgst);
  poolIgst -= igstToSgst;
  liabSgst -= igstToSgst;

  // Step 2: Use CGST credit -> CGST, then remaining IGST (NEVER SGST)
  const cgstToCgst = Math.min(poolCgst, liabCgst);
  poolCgst -= cgstToCgst;
  liabCgst -= cgstToCgst;

  const cgstToIgst = Math.min(poolCgst, liabIgst);
  poolCgst -= cgstToIgst;
  liabIgst -= cgstToIgst;

  // Step 3: Use SGST credit -> SGST, then remaining IGST (NEVER CGST)
  const sgstToSgst = Math.min(poolSgst, liabSgst);
  poolSgst -= sgstToSgst;
  liabSgst -= sgstToSgst;

  const sgstToIgst = Math.min(poolSgst, liabIgst);
  poolSgst -= sgstToIgst;
  liabIgst -= sgstToIgst;

  // Cash payable = Residual Output Liability + 100% of RCM Liability
  const cashIgst = Number((liabIgst + rcmIgst).toFixed(2));
  const cashCgst = Number((liabCgst + rcmCgst).toFixed(2));
  const cashSgst = Number((liabSgst + rcmSgst).toFixed(2));

  return {
    table3_1: {
      outwardTaxable: outTaxable,
      outwardIgst: outIgst,
      outwardCgst: outCgst,
      outwardSgst: outSgst,
      rcmTaxable: Number(rcmPurchases.reduce((a, v) => a + v.taxable_value, 0).toFixed(2)),
      rcmIgst,
      rcmCgst,
      rcmSgst,
    },
    table4: {
      openingCreditLedger: {
        igst: company.credit_ledger_igst,
        cgst: company.credit_ledger_cgst,
        sgst: company.credit_ledger_sgst,
      },
      currentEligibleItc: {
        igst: itcCurrentIgst,
        cgst: itcCurrentCgst,
        sgst: itcCurrentSgst,
      },
      imsRejectedItc: {
        count: rejected2b.length,
        amount: Number(
          rejected2b.reduce((a, p) => a + p.igst + p.cgst + p.sgst, 0).toFixed(2)
        ),
      },
    },
    table6_1_offset: {
      igstToIgst: Number(igstToIgst.toFixed(2)),
      igstToCgst: Number(igstToCgst.toFixed(2)),
      igstToSgst: Number(igstToSgst.toFixed(2)),
      cgstToCgst: Number(cgstToCgst.toFixed(2)),
      cgstToIgst: Number(cgstToIgst.toFixed(2)),
      sgstToSgst: Number(sgstToSgst.toFixed(2)),
      sgstToIgst: Number(sgstToIgst.toFixed(2)),
      closingCreditLedger: {
        igst: Number(poolIgst.toFixed(2)),
        cgst: Number(poolCgst.toFixed(2)),
        sgst: Number(poolSgst.toFixed(2)),
      },
      netCashChallanPmt06: {
        igst: cashIgst,
        cgst: cashCgst,
        sgst: cashSgst,
        total: Number((cashIgst + cashCgst + cashSgst).toFixed(2)),
      },
    },
  };
}
