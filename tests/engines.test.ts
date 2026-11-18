import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { initSchemaAndSeed } from '../server/db.ts';
import {
  autoFixGstIssue,
  buildValidGstin,
  computeGstr3bSummary,
  generateGstr1Json,
  reconcileGstBooksVsPortal,
  runSmartGstValidations,
  validateGstin,
} from '../server/gstEngine.ts';
import { processBankStatementRows } from '../server/parserEngine.ts';
import {
  generateTallyMastersXml,
  generateTallyVouchersXml,
} from '../server/tallyXml.ts';
import type {
  BankRuleRecord,
  BankTransactionRecord,
  CompanyRecord,
  LedgerRecord,
  PortalInvoiceRecord,
  StockItemRecord,
  VoucherRecord,
} from '../server/types.ts';

describe('Vyapar TaxOne Rebuilt Core Engines', () => {
  it('computes and validates official 15-digit Indian GSTIN Modulo-36 check digits', () => {
    const validSurat = buildValidGstin('24AABCS9142G1Z');
    expect(validSurat).toHaveLength(15);
    const check = validateGstin(validSurat);
    expect(check.valid).toBe(true);
    expect(check.stateCode).toBe('24');
    expect(check.stateName).toBe('Gujarat');

    const tampered =
      validSurat.slice(0, 14) + (validSurat[14] === 'A' ? 'B' : 'A');
    const badCheck = validateGstin(tampered);
    expect(badCheck.valid).toBe(false);
    expect(badCheck.expectedChecksum).toBe(validSurat[14]);
  });

  it('seeds SQLite cleanly, runs all 32 Smart GST Validations, and executes 1-click auto-fixes', () => {
    const db = new DatabaseSync(':memory:');
    initSchemaAndSeed(db);

    const company = db
      .prepare('SELECT * FROM companies WHERE id = 1')
      .get() as unknown as CompanyRecord;
    const vouchersBefore = db
      .prepare('SELECT * FROM vouchers WHERE company_id = 1')
      .all() as unknown as VoucherRecord[];

    const initialAudit = runSmartGstValidations(company, vouchersBefore);
    expect(initialAudit.totalRules).toBe(32);
    expect(initialAudit.totalIssues).toBeGreaterThanOrEqual(3);

    // Auto-fix every auto-fixable issue in Company 1
    for (const rule of initialAudit.rules) {
      for (const issue of rule.issues) {
        if (issue.fixType !== 'MANUAL_REVIEW') {
          const fixRes = autoFixGstIssue(db, company, issue.voucherId, issue.fixType);
          expect(fixRes.fixed).toBe(true);
        }
      }
    }

    const vouchersAfter = db
      .prepare('SELECT * FROM vouchers WHERE company_id = 1')
      .all() as unknown as VoucherRecord[];
    const postAudit = runSmartGstValidations(company, vouchersAfter);
    expect(postAudit.totalIssues).toBe(0);
    expect(postAudit.passedRules).toBe(32);
  });

  it('reconciles GSTR-2B vs Tally Books across all 4 views and respects IMS Rejected status', () => {
    const db = new DatabaseSync(':memory:');
    initSchemaAndSeed(db);

    const company = db
      .prepare('SELECT * FROM companies WHERE id = 1')
      .get() as unknown as CompanyRecord;
    const vouchers = db
      .prepare('SELECT * FROM vouchers WHERE company_id = 1')
      .all() as unknown as VoucherRecord[];
    const portal = db
      .prepare('SELECT * FROM gstr_portal_invoices WHERE company_id = 1')
      .all() as unknown as PortalInvoiceRecord[];

    const reco = reconcileGstBooksVsPortal('GSTR-2B', vouchers, portal);
    expect(reco.summaryView).toHaveLength(6);
    expect(reco.voucherView.length).toBeGreaterThanOrEqual(5);
    expect(reco.vendorView.length).toBeGreaterThanOrEqual(4);

    const gstr3b = computeGstr3bSummary(company, vouchers, portal);
    expect(gstr3b.table4.imsRejectedItc.count).toBe(1);
    expect(gstr3b.table4.imsRejectedItc.amount).toBe(3240);
    // RCM liability u/s 49(4) must always appear in cash challan even when ITC exists
    expect(gstr3b.table6_1_offset.netCashChallanPmt06.total).toBeGreaterThanOrEqual(2000);

    const gstr1 = generateGstr1Json(company, '102025', vouchers);
    expect(gstr1.gstnPayload.gstin).toBe(company.gstin);
    expect(gstr1.gstnPayload.b2b.length).toBeGreaterThan(0);
  });

  it('generates balanced TallyPrime XML Envelopes where Debit + Credit ledger amounts sum to 0.00', () => {
    const db = new DatabaseSync(':memory:');
    initSchemaAndSeed(db);

    const ledgers = db
      .prepare('SELECT * FROM ledgers WHERE company_id = 1')
      .all() as unknown as LedgerRecord[];
    const items = db
      .prepare('SELECT * FROM stock_items WHERE company_id = 1')
      .all() as unknown as StockItemRecord[];
    const vouchers = db
      .prepare('SELECT * FROM vouchers WHERE company_id = 1 LIMIT 2')
      .all() as unknown as VoucherRecord[];

    const mastersXml = generateTallyMastersXml('Suryavanshi FY 25-26', ledgers, items);
    expect(mastersXml).toContain('<REPORTNAME>All Masters</REPORTNAME>');
    expect(mastersXml).toContain('<LEDGER NAME=');
    expect(mastersXml).toContain('<STOCKITEM NAME=');

    const vouchersXml = generateTallyVouchersXml('Suryavanshi FY 25-26', [vouchers[0]]);
    expect(vouchersXml).toContain('<REPORTNAME>Vouchers</REPORTNAME>');
    const amounts = Array.from(
      vouchersXml.matchAll(/<ALLLEDGERENTRIES\.LIST>[\s\S]*?<AMOUNT>([-\d.]+)<\/AMOUNT>/g)
    ).map((m) => Number.parseFloat(m[1]));
    expect(amounts.length).toBeGreaterThanOrEqual(2);
    const netSum = amounts.reduce((a, b) => a + b, 0);
    expect(Math.abs(netSum)).toBeLessThan(0.01);
  });

  it('auto-categorizes bank statement narrations and flags duplicate overlap entries', () => {
    const db = new DatabaseSync(':memory:');
    initSchemaAndSeed(db);

    const existing = db
      .prepare('SELECT * FROM bank_transactions WHERE company_id = 1')
      .all() as unknown as BankTransactionRecord[];
    const rules = db
      .prepare('SELECT * FROM bank_rules WHERE company_id = 1')
      .all() as unknown as BankRuleRecord[];

    const processed = processBankStatementRows(
      1,
      'HDFC Bank Current A/c - 0542',
      'TestOverlap.csv',
      [
        {
          Date: '2025-10-09',
          Narration: 'BIL/00948210/DGVCL INDUSTRIAL HT POWER BILL OCT',
          Withdrawal: 46850,
          Deposit: 0,
          Balance: 1391050,
        },
        {
          Date: '2025-10-30',
          Narration: 'RTGS CR-PATEL SYNTHETICS AND YARNS-INV200',
          Withdrawal: 0,
          Deposit: 95000,
          Balance: 1486050,
        },
      ],
      existing,
      rules
    );

    expect(processed).toHaveLength(2);
    expect(processed[0].is_duplicate).toBe(1);
    expect(processed[0].mapped_ledger).toBe('Electricity & DG Power Charges');
    expect(processed[1].is_duplicate).toBe(0);
    expect(processed[1].voucher_type).toBe('Receipt');
    expect(processed[1].mapped_ledger).toBe('Patel Synthetics & Yarns Ltd');
  });
});
