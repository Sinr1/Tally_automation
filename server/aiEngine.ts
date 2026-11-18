import type { DatabaseSync } from 'node:sqlite';
import {
  computeGstr3bSummary,
  reconcileGstBooksVsPortal,
  runSmartGstValidations,
} from './gstEngine.ts';
import type {
  BankTransactionRecord,
  CompanyRecord,
  PortalInvoiceRecord,
  VoucherRecord,
} from './types.ts';

export interface ChanakyaReply {
  answerMarkdown: string;
  citations: string[];
  liveMetricsUsed: Record<string, string | number>;
  suggestedActions: { label: string; route: string }[];
}

export function askChanakyaAi(
  db: DatabaseSync,
  companyId: number,
  prompt: string
): ChanakyaReply {
  const company = db
    .prepare('SELECT * FROM companies WHERE id = ?')
    .get(companyId) as unknown as CompanyRecord | undefined;

  if (!company) {
    return {
      answerMarkdown: 'Please select an active client company first to query live books.',
      citations: [],
      liveMetricsUsed: {},
      suggestedActions: [{ label: 'Manage Companies', route: '/app/home/company' }],
    };
  }

  const vouchers = db
    .prepare('SELECT * FROM vouchers WHERE company_id = ?')
    .all(companyId) as unknown as VoucherRecord[];
  const portalInvoices = db
    .prepare('SELECT * FROM gstr_portal_invoices WHERE company_id = ?')
    .all(companyId) as unknown as PortalInvoiceRecord[];
  const bankTxns = db
    .prepare('SELECT * FROM bank_transactions WHERE company_id = ?')
    .all(companyId) as unknown as BankTransactionRecord[];

  const validations = runSmartGstValidations(company, vouchers);
  const reco2b = reconcileGstBooksVsPortal('GSTR-2B', vouchers, portalInvoices);
  const gstr3b = computeGstr3bSummary(company, vouchers, portalInvoices);

  const unmappedBank = bankTxns.filter((b) => b.status === 'Unmapped').length;
  const duplicateBank = bankTxns.filter((b) => b.is_duplicate === 1).length;

  const q = prompt.toLowerCase();

  const liveMetrics = {
    Company: company.name,
    GSTIN: company.gstin,
    '32-Rule Issues': validations.totalIssues,
    'GSTR-2B Eligible ITC': `₹${reco2b.totals.eligibleImsItc.toLocaleString('en-IN')}`,
    'Net Cash PMT-06': `₹${gstr3b.table6_1_offset.netCashChallanPmt06.total.toLocaleString('en-IN')}`,
    'Unmapped Bank Rows': unmappedBank,
  };

  if (q.includes('43b') || q.includes('msme')) {
    return {
      answerMarkdown: `### Section 43B(h) — MSME 15/45-Day Payment Compliance (${company.name})

Under **Section 43B(h) of the Income Tax Act, 1961** (applicable from AY 2024-25 onwards):
- Sums payable to **Micro or Small Enterprises** (Udyam-registered manufacturers & service providers, *excluding* pure traders) are allowed as a deduction **only in the year of actual payment** if paid beyond the Section 15 MSMED Act deadline:
  - **15 days** where there is no written agreement, or
  - **Up to 45 days** where a written agreement exists.

**Live Books Screening for ${company.name}:**
- Purchase Vouchers Analysed: **${vouchers.filter((v) => v.voucher_type === 'Purchase').length}**
- Unmapped Bank Outflows Pending Vendor Knock-off: **${unmappedBank} entries** (reconcile these first in **Banking** so paid MSME bills aren't falsely flagged as unpaid on 31st March).`,
      citations: [
        'Section 43B(h), Income Tax Act, 1961',
        'Section 15 & Section 2(e)/(h)/(m), MSMED Act, 2006',
      ],
      liveMetricsUsed: liveMetrics,
      suggestedActions: [
        { label: 'Review Bank Statements', route: '/app/da/banking' },
        { label: 'Inspect Purchase Register', route: '/app/da/purchase' },
      ],
    };
  }

  if (q.includes('ims') || q.includes('2b') || q.includes('itc') || q.includes('reconcil')) {
    const missingInPortal = reco2b.summaryView.find((s) => s.status === 'In Books Only');
    const portalOnly = reco2b.summaryView.find((s) => s.status === 'In Portal Only');
    return {
      answerMarkdown: `### GSTR-2B & IMS Input Tax Credit Audit — ${company.name}

Per **Section 16(2)(aa) CGST Act** read with **Rule 36(4)** and GSTN's **Invoice Management System (IMS)**:
- Input Tax Credit can only be availed in **GSTR-3B Table 4(A)(5)** when the supplier's invoice appears in **GSTR-2B** and is **not Rejected** on the IMS dashboard.
- Marking an invoice **Pending** on IMS carries it forward without adding to current-month GSTR-2B; marking **Rejected** excludes it immediately and increases supplier liability if credit note rules apply.

**Live Reconciliation Snapshot (${company.gstin}):**
- **Books Input Tax**: ₹${reco2b.totals.booksTotalTax.toLocaleString('en-IN')}
- **Portal GSTR-2B Tax**: ₹${reco2b.totals.portalTotalTax.toLocaleString('en-IN')}
- **IMS Eligible ITC**: **₹${reco2b.totals.eligibleImsItc.toLocaleString('en-IN')}**
- **In Books Only (At-Risk ITC)**: ${missingInPortal?.count || 0} invoices (₹${(missingInPortal?.booksTax || 0).toLocaleString('en-IN')}) — trigger a WhatsApp vendor reminder via **TaxOne Chat**!
- **In Portal Only (Unbooked Bills)**: ${portalOnly?.count || 0} invoices (₹${(portalOnly?.portalTax || 0).toLocaleString('en-IN')}).`,
      citations: [
        'Section 16(2)(aa) & Section 16(2)(ba), CGST Act, 2017',
        'GSTN Advisory on Invoice Management System (IMS)',
      ],
      liveMetricsUsed: liveMetrics,
      suggestedActions: [
        { label: 'Open IMS & GSTR-2B Reco', route: '/app/ga/audit/ims' },
        { label: 'Send Vendor WhatsApp Reminder', route: '/app/chat' },
      ],
    };
  }

  if (q.includes('3b') || q.includes('offset') || q.includes('cash') || q.includes('challan')) {
    const off = gstr3b.table6_1_offset;
    return {
      answerMarkdown: `### GSTR-3B Section 49A & Rule 88A Offset Computation — ${company.name}

Under **Section 49A / 49B** and **Rule 88A CGST Rules**, **IGST credit must be completely exhausted first** (against IGST -> CGST -> SGST) before touching CGST or SGST credits, and **RCM liability u/s 9(3)/9(4) must always be discharged in Cash**.

**Computed Table 6.1 Offset for ${company.name}:**
- **Outward Tax Liability**: IGST ₹${gstr3b.table3_1.outwardIgst.toLocaleString('en-IN')} | CGST ₹${gstr3b.table3_1.outwardCgst.toLocaleString('en-IN')} | SGST ₹${gstr3b.table3_1.outwardSgst.toLocaleString('en-IN')}
- **RCM Cash Liability**: ₹${(gstr3b.table3_1.rcmIgst + gstr3b.table3_1.rcmCgst + gstr3b.table3_1.rcmSgst).toLocaleString('en-IN')}
- **IGST Credit Utilized**: ₹${off.igstToIgst.toLocaleString('en-IN')} (to IGST), ₹${off.igstToCgst.toLocaleString('en-IN')} (to CGST), ₹${off.igstToSgst.toLocaleString('en-IN')} (to SGST)
- **Net PMT-06 Cash Challan Payable**: **₹${off.netCashChallanPmt06.total.toLocaleString('en-IN')}**`,
      citations: [
        'Section 49, 49A, 49B CGST Act, 2017',
        'Rule 88A & Rule 86B, CGST Rules, 2017',
      ],
      liveMetricsUsed: liveMetrics,
      suggestedActions: [
        { label: 'Open GSTR-3B Offset Workbench', route: '/app/ga/gstr3b-filing' },
      ],
    };
  }

  if (q.includes('bank') || q.includes('duplicate') || q.includes('tally')) {
    return {
      answerMarkdown: `### Banking & TallyPrime Sync Health — ${company.name}

- **Statement Rows Loaded**: **${bankTxns.length}**
- **Unmapped Rows Requiring Ledger**: **${unmappedBank}**
- **Orange-Flag Duplicate Rows Blocked**: **${duplicateBank}** (preventing double posting into TallyPrime \`${company.tally_company_name}\`)
- **Tally Connector Target**: \`http://127.0.0.1:${company.tally_connector_port}\` (${company.tally_sync_status})

**Recommended Workflow:**
1. Create a Keyword Rule in **Banking -> Manage Rules** for recurring narrations (NEFT/UPI/Charges).
2. Review flagged duplicate rows and push verified entries via **Generate / Sync Tally XML**.`,
      citations: ['TallyPrime XML Import Specification (<ENVELOPE> Vouchers Schema)'],
      liveMetricsUsed: liveMetrics,
      suggestedActions: [
        { label: 'Open Banking Automation', route: '/app/da/banking' },
        { label: 'Manage Smart Bank Rules', route: '/app/da/rulelist' },
      ],
    };
  }

  // Default comprehensive health audit + statutory guidance
  const topFailedRules = validations.rules
    .filter((r) => r.issueCount > 0)
    .slice(0, 4)
    .map((r) => `- **${r.ruleId} (${r.ruleName})**: ${r.issueCount} issue(s) — *${r.issues[0]?.detail}*`)
    .join('\n');

  return {
    answerMarkdown: `### Chanakya AI Executive Compliance Brief — ${company.name} (\`${company.gstin}\`)

I scanned your live SQLite books, 32-rule GST validator, GSTR-2B/IMS portal feed, and banking ledger:

1. **Smart GST Validation (${validations.passedRules}/${validations.totalRules} Rules Passed)**:
${topFailedRules || '- All 32 GST validation rules passed cleanly!'}
2. **GSTR-2B & IMS Position**: Eligible ITC is **₹${reco2b.totals.eligibleImsItc.toLocaleString('en-IN')}** with **${reco2b.totals.actionRequired}** reconciliation variance(s).
3. **GSTR-3B Net Cash Payable (PMT-06)**: **₹${gstr3b.table6_1_offset.netCashChallanPmt06.total.toLocaleString('en-IN')}** after Rule 88A cross-utilization.
4. **Banking Pre-Accounting**: **${unmappedBank}** unmapped row(s) and **${duplicateBank}** duplicate entry guard alert(s).

*Ask me specifically about **Section 43B(h) MSME**, **GSTR-2B / IMS actions**, **GSTR-3B Rule 88A offset**, or **Banking duplicate sync**.*`,
    citations: [
      'CGST Act 2017 — Sec 16, Sec 37, Sec 39, Sec 49A & Rule 88A',
      'CBIC 6-Digit Mandatory HSN Advisory (FY 2025-26)',
    ],
    liveMetricsUsed: liveMetrics,
    suggestedActions: [
      { label: 'Fix 32-Rule GST Errors', route: '/app/ga/audit/reviewAndFix' },
      { label: 'Reconcile GSTR-2B / IMS', route: '/app/ga/audit/ims' },
      { label: 'Open Banking Automation', route: '/app/da/banking' },
    ],
  };
}
