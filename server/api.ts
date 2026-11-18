import express from 'express';
import { askChanakyaAi } from './aiEngine.ts';
import { getDb } from './db.ts';
import {
  INDIAN_STATES,
  autoFixGstIssue,
  buildValidGstin,
  computeGstr3bSummary,
  generateGstr1Json,
  reconcileGstBooksVsPortal,
  runSmartGstValidations,
  validateGstin,
} from './gstEngine.ts';
import {
  extractInvoiceViaOcr,
  mapBulkRowsToVouchers,
  matchBankRule,
  parseSpreadsheetInput,
  processBankStatementRows,
} from './parserEngine.ts';
import {
  generateBankTransactionsTallyXml,
  generateTallyMastersXml,
  generateTallyVouchersXml,
  pushXmlToTallyConnector,
} from './tallyXml.ts';
import type {
  BankRuleRecord,
  BankTransactionRecord,
  CompanyRecord,
  LedgerRecord,
  PortalInvoiceRecord,
  StockItemRecord,
  VoucherRecord,
} from './types.ts';

export function createApiApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    const requiredKey = process.env.TAXONE_API_KEY;
    if (
      requiredKey &&
      req.path.startsWith('/api/') &&
      req.path !== '/api/health' &&
      req.header('x-taxone-key') !== requiredKey
    ) {
      res.status(401).json({ error: 'Unauthorized: valid x-taxone-key header required' });
      return;
    }
    next();
  });

  app.use(express.json({ limit: '10mb' }));

  const logActivity = (companyId: number, actor: string, module: string, action: string) => {
    const db = getDb();
    db.prepare(
      'INSERT INTO activity_logs (company_id, actor, module, action) VALUES (?, ?, ?, ?)'
    ).run(companyId, actor, module, action);
  };

  app.get('/api/health', (_req, res) => {
    const db = getDb();
    const companies = db.prepare('SELECT COUNT(*) as cnt FROM companies').get() as { cnt: number };
    res.json({
      status: 'ok',
      service: 'Vyapar TaxOne Full-Stack Engine',
      runtime: process.version,
      sqliteCompanies: companies.cnt,
    });
  });

  // Auth & Team Users
  app.post('/api/auth/login', (req, res) => {
    const db = getDb();
    const email = String(req.body?.email || 'ca.siddharth@mehtadeshmukh.in').trim();
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      user = db.prepare('SELECT * FROM users ORDER BY id ASC LIMIT 1').get();
    }
    res.json({
      token: 'taxone-session-demo-jwt',
      user,
    });
  });

  app.post('/api/auth/register', (req, res) => {
    const db = getDb();
    const { fullName, email, phone, firmName, role } = req.body || {};
    if (!fullName || !email) {
      res.status(400).json({ error: 'Full name and email are required' });
      return;
    }
    const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim());
    if (existing) {
      res.json({ token: 'taxone-session-demo-jwt', user: existing });
      return;
    }
    const info = db
      .prepare(
        'INSERT INTO users (full_name, email, phone, firm_name, role, permissions_json, vouchers_processed, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        String(fullName).trim(),
        String(email).trim(),
        String(phone || '+91 95582 61955'),
        String(firmName || 'Chartered Accountants Practice'),
        String(role || 'Admin'),
        '["ALL"]',
        0,
        'Active'
      );
    const created = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ token: 'taxone-session-demo-jwt', user: created });
  });

  app.get('/api/auth/users', (_req, res) => {
    const db = getDb();
    const users = db.prepare('SELECT * FROM users ORDER BY id ASC').all();
    res.json({ users });
  });

  app.post('/api/auth/users', (req, res) => {
    const db = getDb();
    const { full_name, email, phone, role, permissions } = req.body || {};
    const info = db
      .prepare(
        'INSERT INTO users (full_name, email, phone, firm_name, role, permissions_json, vouchers_processed, status) VALUES (?, ?, ?, ?, ?, ?, 0, ?)'
      )
      .run(
        String(full_name || 'Staff Member'),
        String(email || `staff${Date.now()}@firm.in`),
        String(phone || '+91 98000 00000'),
        'Mehta & Deshmukh Chartered Accountants',
        String(role || 'GST Executive'),
        JSON.stringify(permissions || ['GST_AUDIT', 'BANKING']),
        'Active'
      );
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    logActivity(1, 'CA Siddharth Mehta', 'User & RBAC', `Invited team member ${full_name} (${role})`);
    res.status(201).json({ user });
  });

  // Companies & Clients
  app.get('/api/companies', (_req, res) => {
    const db = getDb();
    const companies = db.prepare('SELECT * FROM companies ORDER BY id ASC').all();
    res.json({ companies });
  });

  app.post('/api/companies', (req, res) => {
    const db = getDb();
    const { name, trade_name, gstin, tally_company_name, books_source } = req.body || {};
    const rawGstin = String(gstin || buildValidGstin('24AABCT9912K1Z')).trim().toUpperCase();
    const check = validateGstin(rawGstin);
    const stateCode = rawGstin.slice(0, 2);
    const stateName = INDIAN_STATES[stateCode] || 'Gujarat';
    const pan = rawGstin.length >= 12 ? rawGstin.slice(2, 12) : 'AABCT9912K';

    const info = db
      .prepare(
        `INSERT INTO companies (
          name, trade_name, gstin, pan, state_code, state_name, financial_year,
          tally_company_name, tally_connector_port, tally_sync_status, last_tally_sync,
          gst_portal_connected, gst_username, credit_ledger_igst, credit_ledger_cgst, credit_ledger_sgst, books_source
        ) VALUES (?, ?, ?, ?, ?, ?, '2025-26', ?, 9000, 'Connected (Cloud Bridge)', 'Just now', 1, ?, 15000, 8000, 8000, ?)`
      )
      .run(
        String(name || 'New Subscribed Client Pvt Ltd'),
        String(trade_name || name || 'New Client'),
        rawGstin,
        pan,
        stateCode,
        stateName,
        String(tally_company_name || `${name} FY 25-26`),
        `gst_${pan.toLowerCase()}`,
        String(books_source || 'TallyPrime')
      );

    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(info.lastInsertRowid);
    logActivity(
      Number(info.lastInsertRowid),
      'CA Siddharth Mehta',
      'Company Manager',
      `Subscribed company ${name} (${rawGstin}, valid=${check.valid})`
    );
    res.status(201).json({ company, gstinValidation: check });
  });

  app.patch('/api/companies/:id', (req, res) => {
    const db = getDb();
    const id = Number(req.params.id);
    const { gstin, tally_connector_port, gst_portal_connected } = req.body || {};
    if (gstin) {
      const clean = String(gstin).trim().toUpperCase();
      const sc = clean.slice(0, 2);
      db.prepare('UPDATE companies SET gstin = ?, state_code = ?, state_name = ?, pan = ? WHERE id = ?').run(
        clean,
        sc,
        INDIAN_STATES[sc] || 'Gujarat',
        clean.slice(2, 12),
        id
      );
    }
    if (tally_connector_port !== undefined) {
      db.prepare('UPDATE companies SET tally_connector_port = ? WHERE id = ?').run(
        Number(tally_connector_port),
        id
      );
    }
    if (gst_portal_connected !== undefined) {
      db.prepare('UPDATE companies SET gst_portal_connected = ? WHERE id = ?').run(
        Number(gst_portal_connected),
        id
      );
    }
    const updated = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
    res.json({ company: updated });
  });

  app.get('/api/clients', (_req, res) => {
    const db = getDb();
    const clients = db
      .prepare(
        `SELECT c.*, comp.name as company_name, comp.gstin as company_gstin, comp.state_name
         FROM clients c
         JOIN companies comp ON comp.id = c.company_id
         ORDER BY c.id ASC`
      )
      .all();
    res.json({ clients });
  });

  app.post('/api/clients', (req, res) => {
    const db = getDb();
    const { company_id, contact_person, whatsapp_phone, email, filing_frequency, group_tag } =
      req.body || {};
    const info = db
      .prepare(
        'INSERT INTO clients (company_id, contact_person, whatsapp_phone, email, filing_frequency, group_tag, portal_access) VALUES (?, ?, ?, ?, ?, ?, 1)'
      )
      .run(
        Number(company_id || 1),
        String(contact_person || 'Client Contact'),
        String(whatsapp_phone || '+91 98250 00000'),
        String(email || 'client@company.in'),
        String(filing_frequency || 'Monthly'),
        String(group_tag || 'B2B Regular')
      );
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ client });
  });

  // Dashboard Overview (Practice Home + Data Automation + GST KPIs)
  app.get('/api/dashboard', (req, res) => {
    const db = getDb();
    const companyId = Number(req.query.companyId || 1);
    const company = db
      .prepare('SELECT * FROM companies WHERE id = ?')
      .get(companyId) as unknown as CompanyRecord;
    const allCompanies = db.prepare('SELECT * FROM companies').all() as unknown as CompanyRecord[];
    const vouchers = db
      .prepare('SELECT * FROM vouchers WHERE company_id = ? ORDER BY voucher_date DESC')
      .all(companyId) as unknown as VoucherRecord[];
    const bankTxns = db
      .prepare('SELECT * FROM bank_transactions WHERE company_id = ?')
      .all(companyId) as unknown as BankTransactionRecord[];
    const portalInvoices = db
      .prepare('SELECT * FROM gstr_portal_invoices WHERE company_id = ?')
      .all(companyId) as unknown as PortalInvoiceRecord[];
    const tasks = db.prepare('SELECT * FROM pms_tasks WHERE company_id = ?').all(companyId);
    const logs = db
      .prepare('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 12')
      .all();

    const validations = company ? runSmartGstValidations(company, vouchers) : null;
    const reco2b = reconcileGstBooksVsPortal('GSTR-2B', vouchers, portalInvoices);
    const gstr3b = company ? computeGstr3bSummary(company, vouchers, portalInvoices) : null;

    const salesTotal = vouchers
      .filter((v) => v.voucher_type === 'Sales')
      .reduce((a, v) => a + v.total_amount, 0);
    const purchaseTotal = vouchers
      .filter((v) => v.voucher_type === 'Purchase')
      .reduce((a, v) => a + v.total_amount, 0);

    res.json({
      company,
      firmSummary: {
        subscribedCompanies: allCompanies.length,
        totalVouchersAutomated:
          (db.prepare('SELECT COUNT(*) as cnt FROM vouchers').get() as { cnt: number }).cnt +
          (db.prepare('SELECT COUNT(*) as cnt FROM bank_transactions').get() as { cnt: number }).cnt,
        hoursSavedMonthly: 64.5,
        gstPortalConnectedCount: allCompanies.filter((c) => c.gst_portal_connected === 1).length,
      },
      companyMetrics: {
        salesTurnover: Number(salesTotal.toFixed(2)),
        purchaseSpend: Number(purchaseTotal.toFixed(2)),
        totalVouchers: vouchers.length,
        pushedToTally: vouchers.filter((v) => v.tally_status === 'Pushed to Tally').length,
        pendingTallySync: vouchers.filter((v) => v.tally_status !== 'Pushed to Tally').length,
        bankTotalRows: bankTxns.length,
        bankUnmappedRows: bankTxns.filter((b) => b.status === 'Unmapped').length,
        bankDuplicateRows: bankTxns.filter((b) => b.is_duplicate === 1).length,
        gstFailedRules: validations?.failedRules ?? 0,
        gstTotalIssues: validations?.totalIssues ?? 0,
        eligibleImsItc: reco2b.totals.eligibleImsItc,
        netCashChallan: gstr3b?.table6_1_offset.netCashChallanPmt06.total ?? 0,
        openTasks: tasks.length,
      },
      recentActivity: logs,
    });
  });

  // Ledgers & Stock Items + Cross-Company Cloning
  app.get('/api/ledgers', (req, res) => {
    const db = getDb();
    const companyId = Number(req.query.companyId || 1);
    const ledgers = db
      .prepare('SELECT * FROM ledgers WHERE company_id = ? ORDER BY name ASC')
      .all(companyId);
    res.json({ ledgers });
  });

  app.post('/api/ledgers', (req, res) => {
    const db = getDb();
    const { company_id, name, parent_group, gstin, opening_balance } = req.body || {};
    const cleanGstin = String(gstin || '').trim().toUpperCase();
    const sc = cleanGstin.slice(0, 2);
    const stateName = INDIAN_STATES[sc] || String(req.body?.state_name || 'Gujarat');
    const info = db
      .prepare(
        'INSERT INTO ledgers (company_id, name, parent_group, gstin, state_name, opening_balance, tally_synced) VALUES (?, ?, ?, ?, ?, ?, 0)'
      )
      .run(
        Number(company_id || 1),
        String(name).trim(),
        String(parent_group || 'Sundry Debtors'),
        cleanGstin,
        stateName,
        Number(opening_balance || 0)
      );
    const ledger = db.prepare('SELECT * FROM ledgers WHERE id = ?').get(info.lastInsertRowid);
    logActivity(Number(company_id || 1), 'CA Siddharth Mehta', 'Ledger Master', `Created ledger ${name}`);
    res.status(201).json({ ledger, gstinValidation: cleanGstin ? validateGstin(cleanGstin) : null });
  });

  app.post('/api/ledgers/clone', (req, res) => {
    const db = getDb();
    const { fromCompanyId, toCompanyId } = req.body || {};
    const sourceLedgers = db
      .prepare('SELECT * FROM ledgers WHERE company_id = ?')
      .all(Number(fromCompanyId)) as unknown as LedgerRecord[];
    const existingNames = new Set(
      (
        db
          .prepare('SELECT name FROM ledgers WHERE company_id = ?')
          .all(Number(toCompanyId)) as { name: string }[]
      ).map((r) => r.name.toLowerCase())
    );
    const ins = db.prepare(
      'INSERT INTO ledgers (company_id, name, parent_group, gstin, state_name, opening_balance, tally_synced) VALUES (?, ?, ?, ?, ?, 0, 0)'
    );
    let cloned = 0;
    for (const l of sourceLedgers) {
      if (!existingNames.has(l.name.toLowerCase())) {
        ins.run(Number(toCompanyId), l.name, l.parent_group, l.gstin, l.state_name);
        cloned += 1;
      }
    }
    logActivity(Number(toCompanyId), 'CA Siddharth Mehta', 'Ledger Master', `Cloned ${cloned} ledgers from company #${fromCompanyId}`);
    res.json({ cloned });
  });

  app.get('/api/items', (req, res) => {
    const db = getDb();
    const companyId = Number(req.query.companyId || 1);
    const items = db
      .prepare('SELECT * FROM stock_items WHERE company_id = ? ORDER BY name ASC')
      .all(companyId);
    res.json({ items });
  });

  app.post('/api/items', (req, res) => {
    const db = getDb();
    const { company_id, name, base_unit, hsn_code, gst_rate, opening_qty, opening_value } =
      req.body || {};
    const info = db
      .prepare(
        'INSERT INTO stock_items (company_id, name, base_unit, hsn_code, gst_rate, opening_qty, opening_value, tally_synced) VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
      )
      .run(
        Number(company_id || 1),
        String(name).trim(),
        String(base_unit || 'NOS'),
        String(hsn_code || '847130'),
        Number(gst_rate ?? 18),
        Number(opening_qty || 0),
        Number(opening_value || 0)
      );
    const item = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ item });
  });

  app.post('/api/items/clone', (req, res) => {
    const db = getDb();
    const { fromCompanyId, toCompanyId } = req.body || {};
    const sourceItems = db
      .prepare('SELECT * FROM stock_items WHERE company_id = ?')
      .all(Number(fromCompanyId)) as unknown as StockItemRecord[];
    const existing = new Set(
      (
        db
          .prepare('SELECT name FROM stock_items WHERE company_id = ?')
          .all(Number(toCompanyId)) as { name: string }[]
      ).map((r) => r.name.toLowerCase())
    );
    const ins = db.prepare(
      'INSERT INTO stock_items (company_id, name, base_unit, hsn_code, gst_rate, opening_qty, opening_value, tally_synced) VALUES (?, ?, ?, ?, ?, 0, 0, 0)'
    );
    let cloned = 0;
    for (const s of sourceItems) {
      if (!existing.has(s.name.toLowerCase())) {
        ins.run(Number(toCompanyId), s.name, s.base_unit, s.hsn_code, s.gst_rate);
        cloned += 1;
      }
    }
    res.json({ cloned });
  });

  // Banking Automation & Smart Rules
  app.get('/api/banking/transactions', (req, res) => {
    const db = getDb();
    const companyId = Number(req.query.companyId || 1);
    const transactions = db
      .prepare('SELECT * FROM bank_transactions WHERE company_id = ? ORDER BY tx_date DESC, id DESC')
      .all(companyId);
    res.json({ transactions });
  });

  app.patch('/api/banking/transactions/:id', (req, res) => {
    const db = getDb();
    const id = Number(req.params.id);
    const { mapped_ledger, voucher_type, status, is_duplicate } = req.body || {};
    const current = db
      .prepare('SELECT * FROM bank_transactions WHERE id = ?')
      .get(id) as unknown as BankTransactionRecord | undefined;
    if (!current) {
      res.status(404).json({ error: 'Bank transaction not found' });
      return;
    }
    const nextLedger = mapped_ledger !== undefined ? String(mapped_ledger) : current.mapped_ledger;
    const nextType = voucher_type !== undefined ? String(voucher_type) : current.voucher_type;
    const nextStatus =
      status !== undefined ? String(status) : nextLedger ? 'Reviewed' : 'Unmapped';
    const nextDup = is_duplicate !== undefined ? Number(is_duplicate) : current.is_duplicate;

    db.prepare(
      'UPDATE bank_transactions SET mapped_ledger = ?, voucher_type = ?, status = ?, is_duplicate = ? WHERE id = ?'
    ).run(nextLedger, nextType, nextStatus, nextDup, id);

    const updated = db.prepare('SELECT * FROM bank_transactions WHERE id = ?').get(id);
    res.json({ transaction: updated });
  });

  app.delete('/api/banking/transactions/:id', (req, res) => {
    const db = getDb();
    db.prepare('DELETE FROM bank_transactions WHERE id = ?').run(Number(req.params.id));
    res.json({ deleted: true });
  });

  app.post('/api/banking/upload', (req, res) => {
    const db = getDb();
    const { companyId, bankLedger, filename, content, encoding } = req.body || {};
    const cid = Number(companyId || 1);
    const parsed = parseSpreadsheetInput(
      String(content || ''),
      encoding === 'base64' ? 'base64' : 'utf8',
      String(filename || 'Statement.csv')
    );
    const existing = db
      .prepare('SELECT * FROM bank_transactions WHERE company_id = ?')
      .all(cid) as unknown as BankTransactionRecord[];
    const rules = db
      .prepare('SELECT * FROM bank_rules WHERE company_id = ?')
      .all(cid) as unknown as BankRuleRecord[];

    const processed = processBankStatementRows(
      cid,
      String(bankLedger || 'HDFC Bank Current A/c - 0542'),
      String(filename || 'Uploaded_Statement.csv'),
      parsed.rows,
      existing,
      rules
    );

    const ins = db.prepare(`
      INSERT INTO bank_transactions (
        company_id, bank_ledger, tx_date, narration, cheque_ref_no,
        withdrawal, deposit, closing_balance, voucher_type, mapped_ledger, status, is_duplicate, source_file
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of processed) {
      ins.run(
        r.company_id,
        r.bank_ledger,
        r.tx_date,
        r.narration,
        r.cheque_ref_no,
        r.withdrawal,
        r.deposit,
        r.closing_balance,
        r.voucher_type,
        r.mapped_ledger,
        r.status,
        r.is_duplicate,
        r.source_file
      );
    }

    logActivity(
      cid,
      'Rohan Prajapati',
      'Banking Upload',
      `Imported ${processed.length} rows from ${filename} (${processed.filter((p) => p.status === 'Auto-Mapped').length} auto-mapped, ${processed.filter((p) => p.is_duplicate === 1).length} duplicates flagged)`
    );

    res.status(201).json({
      importedCount: processed.length,
      autoMappedCount: processed.filter((p) => p.status === 'Auto-Mapped').length,
      duplicateCount: processed.filter((p) => p.is_duplicate === 1).length,
    });
  });

  app.post('/api/banking/apply-rules', (req, res) => {
    const db = getDb();
    const companyId = Number(req.body?.companyId || 1);
    const rules = db
      .prepare('SELECT * FROM bank_rules WHERE company_id = ?')
      .all(companyId) as unknown as BankRuleRecord[];
    const txns = db
      .prepare('SELECT * FROM bank_transactions WHERE company_id = ? AND status = ?')
      .all(companyId, 'Unmapped') as unknown as BankTransactionRecord[];

    const upd = db.prepare(
      'UPDATE bank_transactions SET mapped_ledger = ?, voucher_type = ?, status = ? WHERE id = ?'
    );
    const incRule = db.prepare(
      'UPDATE bank_rules SET matched_count = matched_count + 1 WHERE id = ?'
    );
    let matchedCount = 0;
    for (const tx of txns) {
      const m = matchBankRule(tx.narration, tx.withdrawal, tx.deposit, rules);
      if (m.rule && m.ledger) {
        upd.run(m.ledger, m.voucherType, 'Auto-Mapped', tx.id);
        incRule.run(m.rule.id);
        matchedCount += 1;
      }
    }
    res.json({ matchedCount });
  });

  app.get('/api/banking/rules', (req, res) => {
    const db = getDb();
    const companyId = Number(req.query.companyId || 1);
    const rules = db
      .prepare('SELECT * FROM bank_rules WHERE company_id = ? ORDER BY priority ASC, id ASC')
      .all(companyId);
    res.json({ rules });
  });

  app.post('/api/banking/rules', (req, res) => {
    const db = getDb();
    const { company_id, rule_name, keyword_pattern, direction, voucher_type, target_ledger, priority } =
      req.body || {};
    const cid = Number(company_id || 1);
    const info = db
      .prepare(
        'INSERT INTO bank_rules (company_id, rule_name, keyword_pattern, direction, voucher_type, target_ledger, priority, active, matched_count) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)'
      )
      .run(
        cid,
        String(rule_name || 'Custom Narration Rule'),
        String(keyword_pattern || '').toUpperCase(),
        String(direction || 'Both'),
        String(voucher_type || 'Payment'),
        String(target_ledger || 'Suspense A/c'),
        Number(priority || 10)
      );
    const rule = db.prepare('SELECT * FROM bank_rules WHERE id = ?').get(info.lastInsertRowid);
    logActivity(cid, 'Rohan Prajapati', 'Bank Rules', `Created smart rule "${rule_name}" -> ${target_ledger}`);
    res.status(201).json({ rule });
  });

  app.post('/api/banking/rules/clone', (req, res) => {
    const db = getDb();
    const { fromCompanyId, toCompanyId } = req.body || {};
    const sourceRules = db
      .prepare('SELECT * FROM bank_rules WHERE company_id = ?')
      .all(Number(fromCompanyId)) as unknown as BankRuleRecord[];
    const ins = db.prepare(
      'INSERT INTO bank_rules (company_id, rule_name, keyword_pattern, direction, voucher_type, target_ledger, priority, active, matched_count) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)'
    );
    for (const r of sourceRules) {
      ins.run(
        Number(toCompanyId),
        r.rule_name,
        r.keyword_pattern,
        r.direction,
        r.voucher_type,
        r.target_ledger,
        r.priority
      );
    }
    logActivity(
      Number(toCompanyId),
      'CA Siddharth Mehta',
      'Bank Rules',
      `Cloned ${sourceRules.length} smart rules from company #${fromCompanyId}`
    );
    res.json({ cloned: sourceRules.length });
  });

  // Vouchers (Sales, Purchase, Journal, Manual Cloud, Bulk Excel Wizard, OCR, Vyapar App Sync)
  app.get('/api/vouchers', (req, res) => {
    const db = getDb();
    const companyId = Number(req.query.companyId || 1);
    const voucherType = req.query.voucherType ? String(req.query.voucherType) : '';
    const vouchers = voucherType
      ? db
          .prepare(
            'SELECT * FROM vouchers WHERE company_id = ? AND voucher_type = ? ORDER BY voucher_date DESC, id DESC'
          )
          .all(companyId, voucherType)
      : db
          .prepare('SELECT * FROM vouchers WHERE company_id = ? ORDER BY voucher_date DESC, id DESC')
          .all(companyId);
    res.json({ vouchers });
  });

  app.post('/api/vouchers', (req, res) => {
    const db = getDb();
    const b = req.body || {};
    const cid = Number(b.company_id || 1);
    const company = db
      .prepare('SELECT * FROM companies WHERE id = ?')
      .get(cid) as unknown as CompanyRecord;
    const taxable = Number(b.taxable_value || 0);
    const rate = Number(b.gst_rate ?? 18);
    const pos = String(b.place_of_supply || `${company?.state_code || '24'}-${company?.state_name || 'Gujarat'}`);
    const isIntra = pos.slice(0, 2) === (company?.state_code || '24');
    const autoTax = (taxable * rate) / 100;

    const igst = b.igst !== undefined ? Number(b.igst) : isIntra ? 0 : Number(autoTax.toFixed(2));
    const cgst =
      b.cgst !== undefined ? Number(b.cgst) : isIntra ? Number((autoTax / 2).toFixed(2)) : 0;
    const sgst =
      b.sgst !== undefined ? Number(b.sgst) : isIntra ? Number((autoTax / 2).toFixed(2)) : 0;
    const cess = Number(b.cess || 0);
    const total = Number(
      (b.total_amount !== undefined ? Number(b.total_amount) : taxable + igst + cgst + sgst + cess).toFixed(2)
    );

    const info = db
      .prepare(
        `INSERT INTO vouchers (
          company_id, voucher_type, voucher_no, voucher_date, party_name, party_gstin,
          ledger_name, counter_ledger, place_of_supply, hsn_code, gst_rate,
          taxable_value, igst, cgst, sgst, cess, total_amount, is_rcm,
          ecommerce_gstin, original_invoice_no, narration, source_mode, tally_status, line_items_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        cid,
        String(b.voucher_type || 'Sales'),
        String(b.voucher_no || `VCH-${Date.now().toString().slice(-5)}`),
        String(b.voucher_date || '2025-10-26'),
        String(b.party_name || 'Party Account'),
        String(b.party_gstin || '').trim().toUpperCase(),
        String(b.ledger_name || 'Sales GST 18%'),
        String(b.counter_ledger || ''),
        pos,
        String(b.hsn_code || ''),
        rate,
        taxable,
        igst,
        cgst,
        sgst,
        cess,
        total,
        Number(b.is_rcm ? 1 : 0),
        String(b.ecommerce_gstin || ''),
        String(b.original_invoice_no || ''),
        String(b.narration || ''),
        String(b.source_mode || 'Manual Cloud'),
        'Reviewed',
        JSON.stringify(b.line_items || [])
      );

    const voucher = db.prepare('SELECT * FROM vouchers WHERE id = ?').get(info.lastInsertRowid);
    logActivity(cid, 'CA Siddharth Mehta', 'Vouchers', `Created ${b.voucher_type} voucher ${b.voucher_no}`);
    res.status(201).json({ voucher });
  });

  app.delete('/api/vouchers/:id', (req, res) => {
    const db = getDb();
    db.prepare('DELETE FROM vouchers WHERE id = ?').run(Number(req.params.id));
    res.json({ deleted: true });
  });

  app.post('/api/vouchers/parse-sheet', (req, res) => {
    const { content, encoding, filename } = req.body || {};
    const parsed = parseSpreadsheetInput(
      String(content || ''),
      encoding === 'base64' ? 'base64' : 'utf8',
      String(filename || 'Register.xlsx')
    );
    res.json({
      sheetName: parsed.sheetName,
      headers: parsed.headers,
      previewRows: parsed.rows.slice(0, 15),
      totalRows: parsed.rows.length,
      allRows: parsed.rows,
    });
  });

  app.post('/api/vouchers/bulk-import', (req, res) => {
    const db = getDb();
    const { companyId, voucherType, rows, mapping } = req.body || {};
    const cid = Number(companyId || 1);
    const company = db
      .prepare('SELECT * FROM companies WHERE id = ?')
      .get(cid) as unknown as CompanyRecord;
    const mapped = mapBulkRowsToVouchers(
      cid,
      company?.state_code || '24',
      voucherType || 'Sales',
      rows || [],
      mapping
    );

    const ins = db.prepare(`
      INSERT INTO vouchers (
        company_id, voucher_type, voucher_no, voucher_date, party_name, party_gstin,
        ledger_name, counter_ledger, place_of_supply, hsn_code, gst_rate,
        taxable_value, igst, cgst, sgst, cess, total_amount, is_rcm,
        ecommerce_gstin, original_invoice_no, narration, source_mode, tally_status, line_items_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const v of mapped) {
      ins.run(
        v.company_id,
        v.voucher_type,
        v.voucher_no,
        v.voucher_date,
        v.party_name,
        v.party_gstin,
        v.ledger_name,
        v.counter_ledger,
        v.place_of_supply,
        v.hsn_code,
        v.gst_rate,
        v.taxable_value,
        v.igst,
        v.cgst,
        v.sgst,
        v.cess,
        v.total_amount,
        v.is_rcm,
        v.ecommerce_gstin,
        v.original_invoice_no,
        v.narration,
        v.source_mode,
        v.tally_status,
        v.line_items_json
      );
    }

    logActivity(
      cid,
      'Rohan Prajapati',
      'Bulk Sheet Import',
      `Mapped & imported ${mapped.length} ${voucherType} vouchers via 3-step Tally Column Wizard`
    );
    res.status(201).json({ importedCount: mapped.length });
  });

  app.post('/api/vouchers/ocr-extract', (req, res) => {
    const db = getDb();
    const { companyId, filename, rawText, voucherType } = req.body || {};
    const company = db
      .prepare('SELECT * FROM companies WHERE id = ?')
      .get(Number(companyId || 1)) as unknown as CompanyRecord;
    const extracted = extractInvoiceViaOcr(
      String(filename || 'Scanned_Bill.pdf'),
      String(rawText || ''),
      voucherType === 'Sales' ? 'Sales' : 'Purchase',
      company?.state_code || '24'
    );
    res.json({ extracted });
  });

  app.post('/api/vyapar/sync', (req, res) => {
    const db = getDb();
    const cid = Number(req.body?.companyId || 1);
    const company = db
      .prepare('SELECT * FROM companies WHERE id = ?')
      .get(cid) as unknown as CompanyRecord;
    const vyaparNo = `VYP/${Math.floor(100 + Math.random() * 899)}`;
    const custGstin = buildValidGstin(`${company.state_code}AABCV4190M1Z`);

    db.prepare(
      `INSERT INTO vouchers (
        company_id, voucher_type, voucher_no, voucher_date, party_name, party_gstin,
        ledger_name, counter_ledger, place_of_supply, hsn_code, gst_rate,
        taxable_value, igst, cgst, sgst, cess, total_amount, is_rcm,
        ecommerce_gstin, original_invoice_no, narration, source_mode, tally_status, line_items_json
      ) VALUES (?, 'Sales', ?, '2025-10-26', 'Vyapar Wholesale Distributor', ?, 'Sales GST 18%', '', ?, '847130', 18, 65000, 0, 5850, 5850, 0, 76700, 0, '', '', '1-Click Synced from Vyapar Billing Mobile/Desktop App', 'Vyapar App', 'Reviewed', '[]')`
    ).run(cid, vyaparNo, custGstin, `${company.state_code}-${company.state_name}`);

    logActivity(cid, 'Vyapar Bridge', 'Vyapar App Sync', `Imported Vyapar invoice ${vyaparNo} for TallyPrime mapping`);
    res.json({ syncedCount: 1, voucherNo: vyaparNo });
  });

  // TallyPrime XML Export & Live Connector Push
  app.get('/api/tally/xml/masters', (req, res) => {
    const db = getDb();
    const companyId = Number(req.query.companyId || 1);
    const company = db
      .prepare('SELECT * FROM companies WHERE id = ?')
      .get(companyId) as unknown as CompanyRecord;
    const ledgers = db
      .prepare('SELECT * FROM ledgers WHERE company_id = ?')
      .all(companyId) as unknown as LedgerRecord[];
    const items = db
      .prepare('SELECT * FROM stock_items WHERE company_id = ?')
      .all(companyId) as unknown as StockItemRecord[];

    const xml = generateTallyMastersXml(company.tally_company_name, ledgers, items);
    db.prepare('UPDATE ledgers SET tally_synced = 1 WHERE company_id = ?').run(companyId);
    db.prepare('UPDATE stock_items SET tally_synced = 1 WHERE company_id = ?').run(companyId);
    res.json({
      filename: `${company.trade_name.replace(/\s+/g, '_')}_TallyMasters.xml`,
      xml,
      ledgerCount: ledgers.length,
      itemCount: items.length,
    });
  });

  app.post('/api/tally/sync/vouchers', async (req, res) => {
    const db = getDb();
    const companyId = Number(req.body?.companyId || 1);
    const voucherIds: number[] | undefined = req.body?.voucherIds;

    const company = db
      .prepare('SELECT * FROM companies WHERE id = ?')
      .get(companyId) as unknown as CompanyRecord;
    const allVouchers = db
      .prepare('SELECT * FROM vouchers WHERE company_id = ?')
      .all(companyId) as unknown as VoucherRecord[];

    const targetVouchers =
      voucherIds && voucherIds.length > 0
        ? allVouchers.filter((v) => voucherIds.includes(v.id))
        : allVouchers;

    const xml = generateTallyVouchersXml(company.tally_company_name, targetVouchers);
    const bridge = await pushXmlToTallyConnector(company.tally_connector_port, xml);

    const upd = db.prepare('UPDATE vouchers SET tally_status = ? WHERE id = ?');
    for (const v of targetVouchers) {
      upd.run('Pushed to Tally', v.id);
    }
    db.prepare('UPDATE companies SET last_tally_sync = ?, tally_sync_status = ? WHERE id = ?').run(
      new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
      bridge.mode,
      companyId
    );
    logActivity(
      companyId,
      'CA Siddharth Mehta',
      'Tally Connector',
      `Synced ${targetVouchers.length} vouchers (${bridge.statusMessage})`
    );

    res.json({
      syncedCount: targetVouchers.length,
      bridge,
      filename: `${company.trade_name.replace(/\s+/g, '_')}_Vouchers.xml`,
      xml,
    });
  });

  app.post('/api/tally/sync/banking', async (req, res) => {
    const db = getDb();
    const companyId = Number(req.body?.companyId || 1);
    const company = db
      .prepare('SELECT * FROM companies WHERE id = ?')
      .get(companyId) as unknown as CompanyRecord;
    const txns = db
      .prepare(
        `SELECT * FROM bank_transactions
         WHERE company_id = ? AND mapped_ledger != '' AND is_duplicate = 0`
      )
      .all(companyId) as unknown as BankTransactionRecord[];

    const xml = generateBankTransactionsTallyXml(company.tally_company_name, txns);
    const bridge = await pushXmlToTallyConnector(company.tally_connector_port, xml);

    const upd = db.prepare('UPDATE bank_transactions SET status = ? WHERE id = ?');
    for (const t of txns) {
      upd.run('Pushed to Tally', t.id);
    }
    logActivity(
      companyId,
      'Rohan Prajapati',
      'Banking Tally Sync',
      `Pushed ${txns.length} verified bank entries to TallyPrime`
    );

    res.json({
      syncedCount: txns.length,
      bridge,
      filename: `${company.trade_name.replace(/\s+/g, '_')}_BankingVouchers.xml`,
      xml,
    });
  });

  // GST Automation: 32 Validations, 1-Click Fix, GSTR-1/2A/2B/IMS Reco, GSTR-1 JSON, GSTR-3B Offset, Notices
  app.get('/api/gst/validations', (req, res) => {
    const db = getDb();
    const companyId = Number(req.query.companyId || 1);
    const company = db
      .prepare('SELECT * FROM companies WHERE id = ?')
      .get(companyId) as unknown as CompanyRecord;
    const vouchers = db
      .prepare('SELECT * FROM vouchers WHERE company_id = ?')
      .all(companyId) as unknown as VoucherRecord[];

    const report = runSmartGstValidations(company, vouchers);
    res.json(report);
  });

  app.post('/api/gst/validations/fix', (req, res) => {
    const db = getDb();
    const { companyId, voucherId, fixType } = req.body || {};
    const cid = Number(companyId || 1);
    const company = db
      .prepare('SELECT * FROM companies WHERE id = ?')
      .get(cid) as unknown as CompanyRecord;
    const result = autoFixGstIssue(db, company, Number(voucherId), fixType);
    if (result.fixed) {
      logActivity(cid, 'Neha Kulkarni', 'Smart GST Validation', result.message);
    }
    res.json(result);
  });

  app.get('/api/gst/reconcile', (req, res) => {
    const db = getDb();
    const companyId = Number(req.query.companyId || 1);
    const returnType = (req.query.returnType as 'GSTR-1' | 'GSTR-2A' | 'GSTR-2B') || 'GSTR-2B';
    const vouchers = db
      .prepare('SELECT * FROM vouchers WHERE company_id = ?')
      .all(companyId) as unknown as VoucherRecord[];
    const portalInvoices = db
      .prepare('SELECT * FROM gstr_portal_invoices WHERE company_id = ?')
      .all(companyId) as unknown as PortalInvoiceRecord[];

    const report = reconcileGstBooksVsPortal(returnType, vouchers, portalInvoices);
    res.json(report);
  });

  app.patch('/api/gst/ims/:portalId', (req, res) => {
    const db = getDb();
    const portalId = Number(req.params.portalId);
    const imsStatus = String(req.body?.imsStatus || 'Accepted') as
      | 'Pending'
      | 'Accepted'
      | 'Rejected';
    const row = db
      .prepare('SELECT * FROM gstr_portal_invoices WHERE id = ?')
      .get(portalId) as unknown as PortalInvoiceRecord | undefined;
    if (!row) {
      res.status(404).json({ error: 'Portal invoice not found' });
      return;
    }
    db.prepare('UPDATE gstr_portal_invoices SET ims_status = ? WHERE id = ?').run(
      imsStatus,
      portalId
    );
    logActivity(
      row.company_id,
      'Neha Kulkarni',
      'IMS Action',
      `Marked GSTR-2B invoice ${row.invoice_no} (${row.counterparty_name}) as ${imsStatus}`
    );
    res.json({ updated: true, portalId, imsStatus });
  });

  app.get('/api/gst/gstr1', (req, res) => {
    const db = getDb();
    const companyId = Number(req.query.companyId || 1);
    const period = String(req.query.period || '102025');
    const company = db
      .prepare('SELECT * FROM companies WHERE id = ?')
      .get(companyId) as unknown as CompanyRecord;
    const vouchers = db
      .prepare('SELECT * FROM vouchers WHERE company_id = ?')
      .all(companyId) as unknown as VoucherRecord[];

    res.json(generateGstr1Json(company, period, vouchers));
  });

  app.get('/api/gst/gstr3b', (req, res) => {
    const db = getDb();
    const companyId = Number(req.query.companyId || 1);
    const company = db
      .prepare('SELECT * FROM companies WHERE id = ?')
      .get(companyId) as unknown as CompanyRecord;
    const vouchers = db
      .prepare('SELECT * FROM vouchers WHERE company_id = ?')
      .all(companyId) as unknown as VoucherRecord[];
    const portalInvoices = db
      .prepare('SELECT * FROM gstr_portal_invoices WHERE company_id = ?')
      .all(companyId) as unknown as PortalInvoiceRecord[];

    res.json(computeGstr3bSummary(company, vouchers, portalInvoices));
  });

  app.get('/api/gst/notices', (req, res) => {
    const db = getDb();
    const companyId = Number(req.query.companyId || 1);
    const notices = db
      .prepare('SELECT * FROM gst_notices WHERE company_id = ? ORDER BY id DESC')
      .all(companyId);
    res.json({ notices });
  });

  app.post('/api/gst/notices', (req, res) => {
    const db = getDb();
    const b = req.body || {};
    const info = db
      .prepare(
        `INSERT INTO gst_notices (
          company_id, notice_type, arn_din, section_ref, issue_date, due_date, demand_amount, description, assigned_to, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open')`
      )
      .run(
        Number(b.company_id || 1),
        String(b.notice_type || 'FORM GST DRC-01'),
        String(b.arn_din || `ZD24${Date.now().toString().slice(-9)}K`),
        String(b.section_ref || 'Section 73'),
        String(b.issue_date || '2025-10-26'),
        String(b.due_date || '2025-11-25'),
        Number(b.demand_amount || 0),
        String(b.description || 'GST portal notice'),
        String(b.assigned_to || 'CA Siddharth Mehta')
      );
    const notice = db.prepare('SELECT * FROM gst_notices WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ notice });
  });

  // Vyapar TaxOne Chat (WhatsApp Client Inbox, Document Forwarding, Reminders & Templates)
  app.get('/api/chat/threads', (_req, res) => {
    const db = getDb();
    const threads = db.prepare('SELECT * FROM chat_threads ORDER BY id ASC').all();
    res.json({ threads });
  });

  app.get('/api/chat/threads/:id/messages', (req, res) => {
    const db = getDb();
    const threadId = Number(req.params.id);
    db.prepare('UPDATE chat_threads SET unread_count = 0 WHERE id = ?').run(threadId);
    const messages = db
      .prepare('SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY id ASC')
      .all(threadId);
    res.json({ messages });
  });

  app.post('/api/chat/threads/:id/messages', (req, res) => {
    const db = getDb();
    const threadId = Number(req.params.id);
    const { sender_name, body, attachment_name } = req.body || {};
    const nowLabel = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const info = db
      .prepare(
        'INSERT INTO chat_messages (thread_id, sender_type, sender_name, body, attachment_name, forwarded_module, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        threadId,
        'firm',
        String(sender_name || 'CA Siddharth Mehta'),
        String(body || ''),
        String(attachment_name || ''),
        '',
        nowLabel
      );
    db.prepare('UPDATE chat_threads SET last_message = ?, last_timestamp = ? WHERE id = ?').run(
      String(body || attachment_name || 'Message sent'),
      nowLabel,
      threadId
    );
    const message = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ message });
  });

  app.post('/api/chat/forward-document', (req, res) => {
    const db = getDb();
    const { messageId, targetModule, companyId } = req.body || {};
    const cid = Number(companyId || 1);
    const msg = db
      .prepare('SELECT * FROM chat_messages WHERE id = ?')
      .get(Number(messageId)) as { attachment_name: string } | undefined;

    db.prepare('UPDATE chat_messages SET forwarded_module = ? WHERE id = ?').run(
      String(targetModule),
      Number(messageId)
    );

    if (msg?.attachment_name) {
      db.prepare(
        `INSERT INTO drive_documents (company_id, file_name, folder_category, file_size, uploaded_by, uploaded_at, transfer_status)
         VALUES (?, ?, ?, '640 KB', 'WhatsApp Chat Forward', '2025-10-26', 'Active')`
      ).run(cid, msg.attachment_name, `${targetModule} Inbox`);
    }

    logActivity(
      cid,
      'Neha Kulkarni',
      'TaxOne Chat',
      `Forwarded WhatsApp attachment "${msg?.attachment_name || 'Document'}" directly to ${targetModule}`
    );
    res.json({ forwarded: true, targetModule });
  });

  app.get('/api/chat/reminders', (_req, res) => {
    const db = getDb();
    const reminders = db.prepare('SELECT * FROM scheduled_reminders ORDER BY id DESC').all();
    const templates = db.prepare('SELECT * FROM reminder_templates ORDER BY id ASC').all();
    res.json({ reminders, templates });
  });

  app.post('/api/chat/reminders', (req, res) => {
    const db = getDb();
    const { company_id, template_title, channel, frequency, next_run_date } = req.body || {};
    const info = db
      .prepare(
        'INSERT INTO scheduled_reminders (company_id, template_title, channel, frequency, next_run_date, status) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(
        Number(company_id || 1),
        String(template_title || 'GST Document Reminder'),
        String(channel || 'WhatsApp + Email'),
        String(frequency || 'Monthly'),
        String(next_run_date || '2025-11-05'),
        'Scheduled'
      );
    const reminder = db
      .prepare('SELECT * FROM scheduled_reminders WHERE id = ?')
      .get(info.lastInsertRowid);
    res.status(201).json({ reminder });
  });

  // PMS Tasks
  app.get('/api/pms/tasks', (req, res) => {
    const db = getDb();
    const companyId = req.query.companyId ? Number(req.query.companyId) : null;
    const tasks = companyId
      ? db
          .prepare('SELECT * FROM pms_tasks WHERE company_id = ? ORDER BY id DESC')
          .all(companyId)
      : db.prepare('SELECT * FROM pms_tasks ORDER BY id DESC').all();
    res.json({ tasks });
  });

  app.post('/api/pms/tasks', (req, res) => {
    const db = getDb();
    const { company_id, title, task_category, assignee, priority, due_date, linked_module } =
      req.body || {};
    const info = db
      .prepare(
        'INSERT INTO pms_tasks (company_id, title, task_category, assignee, priority, status, due_date, linked_module) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        Number(company_id || 1),
        String(title || 'New Compliance Task'),
        String(task_category || 'GST Filing'),
        String(assignee || 'Neha Kulkarni'),
        String(priority || 'High'),
        'Todo',
        String(due_date || '2025-11-11'),
        String(linked_module || 'GST Automation')
      );
    const task = db.prepare('SELECT * FROM pms_tasks WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ task });
  });

  app.patch('/api/pms/tasks/:id', (req, res) => {
    const db = getDb();
    const id = Number(req.params.id);
    const { status, priority, assignee } = req.body || {};
    if (status) db.prepare('UPDATE pms_tasks SET status = ? WHERE id = ?').run(String(status), id);
    if (priority)
      db.prepare('UPDATE pms_tasks SET priority = ? WHERE id = ?').run(String(priority), id);
    if (assignee)
      db.prepare('UPDATE pms_tasks SET assignee = ? WHERE id = ?').run(String(assignee), id);
    const task = db.prepare('SELECT * FROM pms_tasks WHERE id = ?').get(id);
    res.json({ task });
  });

  // Vyapar TaxOne Drive
  app.get('/api/drive/documents', (req, res) => {
    const db = getDb();
    const companyId = Number(req.query.companyId || 1);
    const documents = db
      .prepare('SELECT * FROM drive_documents WHERE company_id = ? ORDER BY id DESC')
      .all(companyId);
    res.json({ documents });
  });

  app.post('/api/drive/documents', (req, res) => {
    const db = getDb();
    const { company_id, file_name, folder_category, file_size, uploaded_by, transfer_status } =
      req.body || {};
    const info = db
      .prepare(
        'INSERT INTO drive_documents (company_id, file_name, folder_category, file_size, uploaded_by, uploaded_at, transfer_status) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        Number(company_id || 1),
        String(file_name || 'Document.pdf'),
        String(folder_category || 'Client Uploads'),
        String(file_size || '512 KB'),
        String(uploaded_by || 'CA Siddharth Mehta'),
        new Date().toISOString().slice(0, 10),
        String(transfer_status || 'Active')
      );
    const document = db
      .prepare('SELECT * FROM drive_documents WHERE id = ?')
      .get(info.lastInsertRowid);
    res.status(201).json({ document });
  });

  app.patch('/api/drive/documents/:id', (req, res) => {
    const db = getDb();
    const id = Number(req.params.id);
    const { transfer_status } = req.body || {};
    db.prepare('UPDATE drive_documents SET transfer_status = ? WHERE id = ?').run(
      String(transfer_status || 'Accepted'),
      id
    );
    const document = db.prepare('SELECT * FROM drive_documents WHERE id = ?').get(id);
    res.json({ document });
  });

  // Chanakya AI (CA GPT)
  app.post('/api/chanakya/ask', (req, res) => {
    const db = getDb();
    const companyId = Number(req.body?.companyId || 1);
    const prompt = String(req.body?.prompt || 'Give me a live compliance summary');
    const reply = askChanakyaAi(db, companyId, prompt);
    res.json(reply);
  });

  // Activity Logs
  app.get('/api/activity-logs', (req, res) => {
    const db = getDb();
    const companyId = req.query.companyId ? Number(req.query.companyId) : null;
    const logs = companyId
      ? db
          .prepare('SELECT * FROM activity_logs WHERE company_id = ? ORDER BY id DESC LIMIT 50')
          .all(companyId)
      : db.prepare('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 50').all();
    res.json({ logs });
  });

  return app;
}
