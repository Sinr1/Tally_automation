import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { buildValidGstin } from './gstEngine.ts';

let dbInstance: DatabaseSync | null = null;
let activeDbPath = '';

export function getDb(customPath?: string): DatabaseSync {
  const resolvedPath =
    customPath ||
    process.env.TAXONE_DB_PATH ||
    path.resolve(process.cwd(), 'data', 'taxone.sqlite');

  if (dbInstance && activeDbPath === resolvedPath) {
    return dbInstance;
  }

  if (resolvedPath !== ':memory:') {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  }

  const db = new DatabaseSync(resolvedPath);
  db.exec(`PRAGMA journal_mode = WAL;`);
  db.exec(`PRAGMA foreign_keys = ON;`);
  initSchemaAndSeed(db);

  dbInstance = db;
  activeDbPath = resolvedPath;
  return db;
}

export function initSchemaAndSeed(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL DEFAULT '',
      firm_name TEXT NOT NULL DEFAULT 'Mehta & Deshmukh Chartered Accountants',
      role TEXT NOT NULL DEFAULT 'Admin',
      permissions_json TEXT NOT NULL DEFAULT '["ALL"]',
      vouchers_processed INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      trade_name TEXT NOT NULL,
      gstin TEXT NOT NULL,
      pan TEXT NOT NULL,
      state_code TEXT NOT NULL,
      state_name TEXT NOT NULL,
      financial_year TEXT NOT NULL DEFAULT '2025-26',
      tally_company_name TEXT NOT NULL,
      tally_connector_port INTEGER NOT NULL DEFAULT 9000,
      tally_sync_status TEXT NOT NULL DEFAULT 'Connected (Cloud Bridge)',
      last_tally_sync TEXT NOT NULL DEFAULT '2025-10-24 18:15 IST',
      gst_portal_connected INTEGER NOT NULL DEFAULT 1,
      gst_username TEXT NOT NULL DEFAULT '',
      credit_ledger_igst REAL NOT NULL DEFAULT 0,
      credit_ledger_cgst REAL NOT NULL DEFAULT 0,
      credit_ledger_sgst REAL NOT NULL DEFAULT 0,
      books_source TEXT NOT NULL DEFAULT 'TallyPrime'
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      contact_person TEXT NOT NULL,
      whatsapp_phone TEXT NOT NULL,
      email TEXT NOT NULL,
      filing_frequency TEXT NOT NULL DEFAULT 'Monthly',
      group_tag TEXT NOT NULL DEFAULT 'Manufacturing B2B',
      portal_access INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS ledgers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      parent_group TEXT NOT NULL,
      gstin TEXT NOT NULL DEFAULT '',
      state_name TEXT NOT NULL DEFAULT 'Gujarat',
      opening_balance REAL NOT NULL DEFAULT 0,
      tally_synced INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS stock_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      base_unit TEXT NOT NULL DEFAULT 'NOS',
      hsn_code TEXT NOT NULL,
      gst_rate REAL NOT NULL DEFAULT 18,
      opening_qty REAL NOT NULL DEFAULT 0,
      opening_value REAL NOT NULL DEFAULT 0,
      tally_synced INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS bank_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      rule_name TEXT NOT NULL,
      keyword_pattern TEXT NOT NULL,
      direction TEXT NOT NULL DEFAULT 'Both',
      voucher_type TEXT NOT NULL DEFAULT 'Payment',
      target_ledger TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 10,
      active INTEGER NOT NULL DEFAULT 1,
      matched_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bank_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      bank_ledger TEXT NOT NULL DEFAULT 'HDFC Bank Current A/c - 0542',
      tx_date TEXT NOT NULL,
      narration TEXT NOT NULL,
      cheque_ref_no TEXT NOT NULL DEFAULT '',
      withdrawal REAL NOT NULL DEFAULT 0,
      deposit REAL NOT NULL DEFAULT 0,
      closing_balance REAL NOT NULL DEFAULT 0,
      voucher_type TEXT NOT NULL DEFAULT 'Payment',
      mapped_ledger TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Unmapped',
      is_duplicate INTEGER NOT NULL DEFAULT 0,
      source_file TEXT NOT NULL DEFAULT 'HDFC_Oct2025_Statement.xlsx'
    );

    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      voucher_type TEXT NOT NULL,
      voucher_no TEXT NOT NULL,
      voucher_date TEXT NOT NULL,
      party_name TEXT NOT NULL,
      party_gstin TEXT NOT NULL DEFAULT '',
      ledger_name TEXT NOT NULL DEFAULT '',
      counter_ledger TEXT NOT NULL DEFAULT '',
      place_of_supply TEXT NOT NULL DEFAULT '',
      hsn_code TEXT NOT NULL DEFAULT '',
      gst_rate REAL NOT NULL DEFAULT 18,
      taxable_value REAL NOT NULL DEFAULT 0,
      igst REAL NOT NULL DEFAULT 0,
      cgst REAL NOT NULL DEFAULT 0,
      sgst REAL NOT NULL DEFAULT 0,
      cess REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      is_rcm INTEGER NOT NULL DEFAULT 0,
      ecommerce_gstin TEXT NOT NULL DEFAULT '',
      original_invoice_no TEXT NOT NULL DEFAULT '',
      narration TEXT NOT NULL DEFAULT '',
      source_mode TEXT NOT NULL DEFAULT 'Bulk Excel',
      tally_status TEXT NOT NULL DEFAULT 'Reviewed',
      line_items_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS gstr_portal_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      return_type TEXT NOT NULL,
      period TEXT NOT NULL DEFAULT '102025',
      counterparty_gstin TEXT NOT NULL,
      counterparty_name TEXT NOT NULL,
      invoice_no TEXT NOT NULL,
      invoice_date TEXT NOT NULL,
      place_of_supply TEXT NOT NULL,
      gst_rate REAL NOT NULL DEFAULT 18,
      taxable_value REAL NOT NULL,
      igst REAL NOT NULL DEFAULT 0,
      cgst REAL NOT NULL DEFAULT 0,
      sgst REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL,
      filing_status TEXT NOT NULL DEFAULT 'Filed',
      ims_status TEXT NOT NULL DEFAULT 'Pending'
    );

    CREATE TABLE IF NOT EXISTS gst_notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      notice_type TEXT NOT NULL,
      arn_din TEXT NOT NULL,
      section_ref TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      demand_amount REAL NOT NULL DEFAULT 0,
      description TEXT NOT NULL,
      assigned_to TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open'
    );

    CREATE TABLE IF NOT EXISTS chat_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      client_name TEXT NOT NULL,
      whatsapp_number TEXT NOT NULL,
      assigned_member TEXT NOT NULL,
      unread_count INTEGER NOT NULL DEFAULT 0,
      last_message TEXT NOT NULL,
      last_timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      sender_type TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      body TEXT NOT NULL,
      attachment_name TEXT NOT NULL DEFAULT '',
      forwarded_module TEXT NOT NULL DEFAULT '',
      sent_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminder_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'WhatsApp + Email',
      body_template TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scheduled_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      template_title TEXT NOT NULL,
      channel TEXT NOT NULL,
      frequency TEXT NOT NULL,
      next_run_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Scheduled'
    );

    CREATE TABLE IF NOT EXISTS pms_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      task_category TEXT NOT NULL,
      assignee TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'High',
      status TEXT NOT NULL DEFAULT 'In Progress',
      due_date TEXT NOT NULL,
      linked_module TEXT NOT NULL DEFAULT 'GST Automation'
    );

    CREATE TABLE IF NOT EXISTS drive_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      folder_category TEXT NOT NULL,
      file_size TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      transfer_status TEXT NOT NULL DEFAULT 'Active'
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      actor TEXT NOT NULL,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM companies').get() as { cnt: number };
  if (countRow.cnt > 0) {
    return;
  }

  // Valid Modulo-36 GSTINs for our 3 client companies + counterparties
  const c1Gstin = buildValidGstin('24AABCS9142G1Z'); // Surat, Gujarat
  const c2Gstin = buildValidGstin('27AADCK4519M1Z'); // Mumbai, Maharashtra
  const c3Gstin = buildValidGstin('29AAFCB8821P1Z'); // Bengaluru, Karnataka

  const custSurat1 = buildValidGstin('24AAACP4120H1Z');
  const custMumbai1 = buildValidGstin('27AABCT3518Q1Z');
  const custDelhi1 = buildValidGstin('07AAACD9012E1Z');

  const suppSurat1 = buildValidGstin('24AABCN6310L1Z');
  const suppMumbai1 = buildValidGstin('27AAECS1928D1Z');
  const suppPune1 = buildValidGstin('27AABCM7741R1Z');
  const suppAhmd1 = buildValidGstin('24AADCV5519B1Z');
  // Intentionally bad checksum on 15th char for R01 demo!
  const flawedChecksumGstin = suppAhmd1.slice(0, 14) + (suppAhmd1[14] === 'Z' ? 'A' : 'Z');

  // Users
  const insUser = db.prepare(
    'INSERT INTO users (full_name, email, phone, firm_name, role, permissions_json, vouchers_processed, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insUser.run(
    'CA Siddharth Mehta',
    'ca.siddharth@mehtadeshmukh.in',
    '+91 98250 44190',
    'Mehta & Deshmukh Chartered Accountants',
    'Admin',
    '["ALL"]',
    4820,
    'Active'
  );
  insUser.run(
    'Neha Kulkarni',
    'neha.gst@mehtadeshmukh.in',
    '+91 97241 88310',
    'Mehta & Deshmukh Chartered Accountants',
    'GST Executive',
    '["GST_AUDIT","GSTR1","GSTR3B","IMS","CHAT"]',
    2195,
    'Active'
  );
  insUser.run(
    'Rohan Prajapati',
    'rohan.audit@mehtadeshmukh.in',
    '+91 99094 11204',
    'Mehta & Deshmukh Chartered Accountants',
    'Audit Head',
    '["BANKING","SALES","PURCHASE","JOURNAL","TALLY_SYNC"]',
    3410,
    'Active'
  );
  insUser.run(
    'Ananya Iyer',
    'ananya.articles@mehtadeshmukh.in',
    '+91 96620 77341',
    'Mehta & Deshmukh Chartered Accountants',
    'Article Assistant',
    '["BANKING","OCR_SCAN","PMS_TASKS"]',
    1290,
    'Active'
  );

  // Companies
  const insComp = db.prepare(`
    INSERT INTO companies (
      name, trade_name, gstin, pan, state_code, state_name, financial_year,
      tally_company_name, tally_connector_port, tally_sync_status, last_tally_sync,
      gst_portal_connected, gst_username, credit_ledger_igst, credit_ledger_cgst, credit_ledger_sgst, books_source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insComp.run(
    'Suryavanshi Precision Textiles Pvt Ltd',
    'Suryavanshi Textiles',
    c1Gstin,
    c1Gstin.slice(2, 12),
    '24',
    'Gujarat',
    '2025-26',
    'Suryavanshi Precision Textiles FY 25-26',
    9000,
    'Connected (Cloud Bridge)',
    '2025-10-26 17:42 IST',
    1,
    'suryavanshi_gst24',
    42000,
    18500,
    18500,
    'Tally + Vyapar'
  );
  insComp.run(
    'Kamdhenu Electro-Mech Components LLP',
    'Kamdhenu Electro-Mech',
    c2Gstin,
    c2Gstin.slice(2, 12),
    '27',
    'Maharashtra',
    '2025-26',
    'Kamdhenu Electro-Mech LLP (25-26)',
    9000,
    'Connected (Cloud Bridge)',
    '2025-10-25 14:18 IST',
    1,
    'kamdhenu_mh27',
    28000,
    14200,
    14200,
    'TallyPrime'
  );
  insComp.run(
    'Bharath Cloud Retail & E-Com Pvt Ltd',
    'Bharath Cloud Retail',
    c3Gstin,
    c3Gstin.slice(2, 12),
    '29',
    'Karnataka',
    '2025-26',
    'Bharath Cloud Retail 2025-26',
    9000,
    'Pending Sync (4 Vouchers)',
    '2025-10-23 11:05 IST',
    1,
    'bharathretail_ka29',
    65000,
    9000,
    9000,
    'Vyapar App'
  );

  // Clients
  const insClient = db.prepare(
    'INSERT INTO clients (company_id, contact_person, whatsapp_phone, email, filing_frequency, group_tag, portal_access) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  insClient.run(1, 'Rajeshbhai Suryavanshi', '+91 98251 77420', 'accounts@suryavanshitextiles.in', 'Monthly', 'Manufacturing B2B', 1);
  insClient.run(2, 'Vikramaditya Deshpande', '+91 98204 51902', 'finance@kamdhenuelectro.com', 'Monthly', 'Engineering & Export', 1);
  insClient.run(3, 'Karthik Subramanian', '+91 98450 66189', 'gst@bharathcloudretail.in', 'QRMP / Monthly', 'E-Commerce Sellers', 1);

  // Ledgers
  const insLedger = db.prepare(
    'INSERT INTO ledgers (company_id, name, parent_group, gstin, state_name, opening_balance, tally_synced) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const c1Ledgers: [string, string, string, string, number, number][] = [
    ['Patel Synthetics & Yarns Ltd', 'Sundry Debtors', custSurat1, 'Gujarat', 245000, 1],
    ['Tata Industrial Fabrics Ltd', 'Sundry Debtors', custMumbai1, 'Maharashtra', 418000, 1],
    ['Delhi Garment Exporters House', 'Sundry Debtors', custDelhi1, 'Delhi', 185000, 1],
    ['Navkar Chemical Dyes Pvt Ltd', 'Sundry Creditors', suppSurat1, 'Gujarat', -162000, 1],
    ['Sahyadri Industrial Spares Co', 'Sundry Creditors', suppMumbai1, 'Maharashtra', -94400, 1],
    ['Pune Precision Looms Pvt Ltd', 'Sundry Creditors', suppPune1, 'Maharashtra', -212400, 1],
    ['Vishwakarma Packaging Solutions', 'Sundry Creditors', suppAhmd1, 'Gujarat', -53100, 0],
    ['HDFC Bank Current A/c - 0542', 'Bank Accounts', '', 'Gujarat', 1284500, 1],
    ['ICICI Bank CC A/c - 9910', 'Bank Accounts', '', 'Gujarat', -450000, 1],
    ['Sales GST 18%', 'Sales Accounts', '', 'Gujarat', 0, 1],
    ['Purchase GST 18%', 'Purchase Accounts', '', 'Gujarat', 0, 1],
    ['Electricity & DG Power Charges', 'Indirect Expenses', '', 'Gujarat', 0, 1],
    ['Bank Charges & Processing Fees', 'Indirect Expenses', '', 'Gujarat', 0, 1],
    ['Staff Salary & Wages Payable', 'Indirect Expenses', '', 'Gujarat', 0, 1],
    ['Cash-in-Hand', 'Cash-in-Hand', '', 'Gujarat', 68500, 1],
  ];
  for (const l of c1Ledgers) {
    insLedger.run(1, l[0], l[1], l[2], l[3], l[4], l[5]);
  }
  insLedger.run(2, 'HDFC Bank Current A/c - Mumbai', 'Bank Accounts', '', 'Maharashtra', 895000, 1);
  insLedger.run(2, 'Sahyadri Industrial Spares Co', 'Sundry Creditors', suppMumbai1, 'Maharashtra', -118000, 1);
  insLedger.run(3, 'Amazon Seller Flex Settlement A/c', 'Sundry Debtors', '', 'Karnataka', 312000, 1);

  // Stock Items
  const insItem = db.prepare(
    'INSERT INTO stock_items (company_id, name, base_unit, hsn_code, gst_rate, opening_qty, opening_value, tally_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insItem.run(1, 'High-Tenacity Polyester Filament Yarn 150D', 'KG', '540247', 12, 2400, 528000, 1);
  insItem.run(1, 'Air-Jet Woven Technical Fabric Roll', 'MTR', '540752', 5, 6500, 910000, 1);
  insItem.run(1, 'PLC Loom Servo Controller Module', 'NOS', '853710', 18, 18, 270000, 1);
  insItem.run(1, 'Reactive Disperse Textile Dye Drum 50Kg', 'BOX', '320411', 18, 45, 191250, 0);
  insItem.run(2, '3-Phase Industrial Contactor Relay 63A', 'NOS', '853649', 18, 320, 448000, 1);

  // Bank Smart Categorization Rules
  const insRule = db.prepare(
    'INSERT INTO bank_rules (company_id, rule_name, keyword_pattern, direction, voucher_type, target_ledger, priority, active, matched_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insRule.run(1, 'DGVCL / Torrent Power Electricity', 'DGVCL|TORRENT POWER|ELECTRICITY', 'Withdrawal', 'Payment', 'Electricity & DG Power Charges', 1, 1, 14);
  insRule.run(1, 'Bank Charges, IMPS & SMS Alerts', 'BANK CHG|IMPS CHG|CONSOLIDATED CHARGES|SMS ALERT', 'Withdrawal', 'Payment', 'Bank Charges & Processing Fees', 2, 1, 29);
  insRule.run(1, 'Patel Synthetics Customer NEFT/RTGS', 'PATEL SYNTHETICS|AAACP4120H', 'Deposit', 'Receipt', 'Patel Synthetics & Yarns Ltd', 3, 1, 19);
  insRule.run(1, 'Navkar Chemical Vendor Payout', 'NAVKAR CHEM|AABCN6310L', 'Withdrawal', 'Payment', 'Navkar Chemical Dyes Pvt Ltd', 4, 1, 11);
  insRule.run(1, 'Self ATM / Cash Withdrawal Contra', 'SELF CASH|ATM WDL|CASH WITHDRAWAL', 'Withdrawal', 'Contra', 'Cash-in-Hand', 5, 1, 7);
  insRule.run(1, 'Monthly Payroll Disbursement', 'SALARY OCT|PAYROLL NEFT', 'Withdrawal', 'Payment', 'Staff Salary & Wages Payable', 6, 1, 12);

  // Bank Transactions (including Auto-Mapped, Unmapped, and an Orange-Flag Duplicate!)
  const insBank = db.prepare(`
    INSERT INTO bank_transactions (
      company_id, bank_ledger, tx_date, narration, cheque_ref_no,
      withdrawal, deposit, closing_balance, voucher_type, mapped_ledger, status, is_duplicate, source_file
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insBank.run(1, 'HDFC Bank Current A/c - 0542', '2025-10-03', 'RTGS CR-HDFC0000241-PATEL SYNTHETICS AND YARNS-INV101', 'HDFCR52025100301', 0, 295000, 1579500, 'Receipt', 'Patel Synthetics & Yarns Ltd', 'Pushed to Tally', 0, 'HDFC_Oct2025_Statement.xlsx');
  insBank.run(1, 'HDFC Bank Current A/c - 0542', '2025-10-06', 'NEFT DR-NAVKAR CHEMICAL DYES PVT LTD-PUR882', 'HDFCN52025100609', 141600, 0, 1437900, 'Payment', 'Navkar Chemical Dyes Pvt Ltd', 'Reviewed', 0, 'HDFC_Oct2025_Statement.xlsx');
  insBank.run(1, 'HDFC Bank Current A/c - 0542', '2025-10-09', 'BIL/00948210/DGVCL INDUSTRIAL HT POWER BILL OCT', 'DGVCL202510', 46850, 0, 1391050, 'Payment', 'Electricity & DG Power Charges', 'Auto-Mapped', 0, 'HDFC_Oct2025_Statement.xlsx');
  insBank.run(1, 'HDFC Bank Current A/c - 0542', '2025-10-09', 'BIL/00948210/DGVCL INDUSTRIAL HT POWER BILL OCT', 'DGVCL202510-DUP', 46850, 0, 1391050, 'Payment', 'Electricity & DG Power Charges', 'Auto-Mapped', 1, 'HDFC_Oct2025_Overlap.csv');
  insBank.run(1, 'HDFC Bank Current A/c - 0542', '2025-10-14', 'UPI/528719902114/SHREE KRISHNA LOGISTICS FREIGHT', 'UPI52871990', 18500, 0, 1372550, 'Payment', '', 'Unmapped', 0, 'HDFC_Oct2025_Statement.xlsx');
  insBank.run(1, 'HDFC Bank Current A/c - 0542', '2025-10-18', 'CHQ PAID-SELF CASH WITHDRAWAL SURAT RING ROAD BR', 'CHQ-004821', 50000, 0, 1322550, 'Contra', 'Cash-in-Hand', 'Auto-Mapped', 0, 'HDFC_Oct2025_Statement.xlsx');
  insBank.run(1, 'HDFC Bank Current A/c - 0542', '2025-10-21', 'NEFT CR-TATA INDUSTRIAL FABRICS LTD MUMBAI', 'TATAR20251021', 0, 472000, 1794550, 'Receipt', '', 'Unmapped', 0, 'HDFC_Oct2025_Statement.xlsx');
  insBank.run(1, 'HDFC Bank Current A/c - 0542', '2025-10-25', 'CONSOLIDATED CHARGES + IMPS CHG OCT 2025', 'CHG-OCT25', 649, 0, 1793901, 'Payment', 'Bank Charges & Processing Fees', 'Auto-Mapped', 0, 'HDFC_Oct2025_Statement.xlsx');

  // Vouchers (Sales, Purchase, Credit Note, Journal — including 3 intentional GST validation errors for live Review & Fix demo!)
  const insVch = db.prepare(`
    INSERT INTO vouchers (
      company_id, voucher_type, voucher_no, voucher_date, party_name, party_gstin,
      ledger_name, counter_ledger, place_of_supply, hsn_code, gst_rate,
      taxable_value, igst, cgst, sgst, cess, total_amount, is_rcm,
      ecommerce_gstin, original_invoice_no, narration, source_mode, tally_status, line_items_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 1. Clean Intra-State B2B Sale (Gujarat -> Gujarat, CGST+SGST)
  insVch.run(
    1, 'Sales', 'SPT/25-26/0101', '2025-10-02', 'Patel Synthetics & Yarns Ltd', custSurat1,
    'Sales GST 18%', '', '24-Gujarat', '540247', 18,
    250000, 0, 22500, 22500, 0, 295000, 0,
    '', '', 'B2B Yarn Dispatch Lot #44', 'Bulk Excel', 'Pushed to Tally',
    JSON.stringify([{ item_name: 'High-Tenacity Polyester Filament Yarn 150D', hsn_code: '540247', qty: 1000, unit: 'KG', rate: 250, amount: 250000, gst_rate: 18 }])
  );

  // 2. Clean Inter-State B2B Sale (Gujarat -> Maharashtra, IGST)
  insVch.run(
    1, 'Sales', 'SPT/25-26/0102', '2025-10-08', 'Tata Industrial Fabrics Ltd', custMumbai1,
    'Sales GST 18%', '', '27-Maharashtra', '540752', 18,
    400000, 72000, 0, 0, 0, 472000, 0,
    '', '', 'Inter-State Technical Fabric Supply', 'Bulk Excel', 'Reviewed', '[]'
  );

  // 3. INTENTIONAL ISSUE #1 (R04): Intra-State Gujarat Sale accidentally booked with IGST instead of CGST+SGST!
  insVch.run(
    1, 'Sales', 'SPT/25-26/0103', '2025-10-12', 'Patel Synthetics & Yarns Ltd', custSurat1,
    'Sales GST 18%', '', '24-Gujarat', '853710', 18,
    150000, 27000, 0, 0, 0, 177000, 0,
    '', '', 'Intra-state invoice erroneously booked under IGST ledger', 'Vyapar App', 'Pending', '[]'
  );

  // 4. Clean B2CL Inter-State Unregistered Sale > 2.5L (Gujarat -> Delhi)
  insVch.run(
    1, 'Sales', 'SPT/25-26/0104', '2025-10-16', ' Malhotra Apparel Exports (Unreg)', '',
    'Sales GST 12%', '', '07-Delhi', '540247', 12,
    280000, 33600, 0, 0, 0, 313600, 0,
    '', '', 'Inter-State B2CL Supply Table 5A', 'Bulk Excel', 'Reviewed', '[]'
  );

  // 5. Credit Note linked to SPT/25-26/0102
  insVch.run(
    1, 'Credit Note', 'CN/25-26/0014', '2025-10-19', 'Tata Industrial Fabrics Ltd', custMumbai1,
    'Sales GST 18%', '', '27-Maharashtra', '540752', 18,
    25000, 4500, 0, 0, 0, 29500, 0,
    '', 'SPT/25-26/0102', 'Rate discount credit note', 'Manual Cloud', 'Reviewed', '[]'
  );

  // 6. Purchase #1 — Exact Match with GSTR-2B (Navkar Chemical, Gujarat)
  insVch.run(
    1, 'Purchase', 'NC/2526/882', '2025-10-04', 'Navkar Chemical Dyes Pvt Ltd', suppSurat1,
    'Purchase GST 18%', '', '24-Gujarat', '320411', 18,
    120000, 0, 10800, 10800, 0, 141600, 0,
    '', '', 'Reactive Textile Dyes Lot 19', 'OCR Scan', 'Pushed to Tally', '[]'
  );

  // 7. Purchase #2 — Value Mismatch vs GSTR-2B (Sahyadri Industrial Spares, Mumbai)
  insVch.run(
    1, 'Purchase', 'SIS/OCT/409', '2025-10-10', 'Sahyadri Industrial Spares Co', suppMumbai1,
    'Purchase GST 18%', '', '24-Gujarat', '853710', 18,
    80000, 14400, 0, 0, 0, 94400, 0,
    '', '', 'PLC Servo Spares Import', 'OCR Scan', 'Reviewed', '[]'
  );

  // 8. Purchase #3 — In Books Only (Supplier Pune Precision Looms hasn't filed GSTR-1 yet!) + INTENTIONAL ISSUE #2 (R08 Missing HSN)
  insVch.run(
    1, 'Purchase', 'PPL-2025-0774', '2025-10-15', 'Pune Precision Looms Pvt Ltd', suppPune1,
    'Purchase GST 18%', '', '24-Gujarat', '', 18,
    180000, 32400, 0, 0, 0, 212400, 0,
    '', '', 'High-speed Rapier Weft Assembly (Missing HSN)', 'Bulk Excel', 'Pending', '[]'
  );

  // 9. Purchase #4 — INTENTIONAL ISSUE #3 (R01 Modulo-36 Checksum typo on Vishwakarma Packaging!)
  insVch.run(
    1, 'Purchase', 'VPS/25-26/0319', '2025-10-20', 'Vishwakarma Packaging Solutions', flawedChecksumGstin,
    'Purchase GST 18%', '', '24-Gujarat', '481910', 18,
    45000, 0, 4050, 4050, 0, 53100, 0,
    '', '', 'Corrugated Export Cartons', 'OCR Scan', 'Pending', '[]'
  );

  // 10. Purchase #5 — RCM GTA Freight u/s 9(3)
  insVch.run(
    1, 'Purchase', 'GTA/OCT/092', '2025-10-22', 'Shree Krishna Roadways GTA', '',
    'Freight Inward RCM 5%', '', '24-Gujarat', '996511', 5,
    40000, 0, 1000, 1000, 0, 40000, 1,
    '', '', 'GTA Road Transport RCM u/s 9(3)', 'Manual Cloud', 'Reviewed', '[]'
  );

  // 11. Journal Voucher — Monthly Depreciation / Provision
  insVch.run(
    1, 'Journal', 'JV/25-26/0041', '2025-10-25', 'Audit Fee Provision A/c', '',
    'Statutory Audit Provision', 'Audit Fee Payable', '24-Gujarat', '', 0,
    35000, 0, 0, 0, 0, 35000, 0,
    '', '', 'Monthly statutory audit provision entry', 'Manual Cloud', 'Reviewed', '[]'
  );

  // Company 2 sample voucher
  insVch.run(
    2, 'Sales', 'KEM/25-26/051', '2025-10-11', 'Tata Industrial Fabrics Ltd', custMumbai1,
    'Sales GST 18%', '', '27-Maharashtra', '853649', 18,
    310000, 0, 27900, 27900, 0, 365800, 0,
    '', '', 'Industrial Contactors Batch 8', 'Bulk Excel', 'Pushed to Tally', '[]'
  );

  // GSTR Portal Invoices (GSTR-1 & GSTR-2B for Reconciliation + IMS!)
  const insPortal = db.prepare(`
    INSERT INTO gstr_portal_invoices (
      company_id, return_type, period, counterparty_gstin, counterparty_name,
      invoice_no, invoice_date, place_of_supply, gst_rate,
      taxable_value, igst, cgst, sgst, total_amount, filing_status, ims_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // GSTR-2B #1: Exact Match with Purchase #6 (Navkar Chemical)
  insPortal.run(
    1, 'GSTR-2B', '102025', suppSurat1, 'Navkar Chemical Dyes Pvt Ltd',
    'NC/2526/882', '2025-10-04', '24-Gujarat', 18,
    120000, 0, 10800, 10800, 141600, 'Filed', 'Accepted'
  );

  // GSTR-2B #2: Value Mismatch vs Purchase #7 (Portal shows ₹75,000 taxable vs Books ₹80,000!)
  insPortal.run(
    1, 'GSTR-2B', '102025', suppMumbai1, 'Sahyadri Industrial Spares Co',
    'SIS/OCT/409', '2025-10-10', '24-Gujarat', 18,
    75000, 13500, 0, 0, 88500, 'Filed', 'Pending'
  );

  // GSTR-2B #3: Fuzzy Match vs Purchase #9 (Vishwakarma Packaging filed as VPS25260319)
  insPortal.run(
    1, 'GSTR-2B', '102025', suppAhmd1, 'Vishwakarma Packaging Solutions',
    'VPS25260319', '2025-10-20', '24-Gujarat', 18,
    45000, 0, 4050, 4050, 53100, 'Filed', 'Accepted'
  );

  // GSTR-2B #4: In Portal Only (Unbooked Cloud Hosting Invoice in GSTR-2B awaiting IMS action!)
  insPortal.run(
    1, 'GSTR-2B', '102025', custMumbai1, 'Zoho Cloud Enterprise India Pvt Ltd',
    'ZIN-2526-99402', '2025-10-18', '24-Gujarat', 18,
    32000, 5760, 0, 0, 37760, 'Filed', 'Pending'
  );

  // GSTR-2B #5: Wrongly billed invoice on GSTN Portal — Rejected on IMS!
  insPortal.run(
    1, 'GSTR-2B', '102025', custDelhi1, 'Unknown Office Caterers Delhi',
    'DEL/CAT/1102', '2025-10-19', '24-Gujarat', 18,
    18000, 3240, 0, 0, 21240, 'Filed', 'Rejected'
  );

  // GSTR-1 Portal Mirror
  insPortal.run(
    1, 'GSTR-1', '102025', custSurat1, 'Patel Synthetics & Yarns Ltd',
    'SPT/25-26/0101', '2025-10-02', '24-Gujarat', 18,
    250000, 0, 22500, 22500, 295000, 'Filed', 'Accepted'
  );
  insPortal.run(
    1, 'GSTR-1', '102025', custMumbai1, 'Tata Industrial Fabrics Ltd',
    'SPT/25-26/0102', '2025-10-08', '27-Maharashtra', 18,
    400000, 72000, 0, 0, 472000, 'Filed', 'Accepted'
  );

  // GST Notices & Orders
  const insNotice = db.prepare(`
    INSERT INTO gst_notices (
      company_id, notice_type, arn_din, section_ref, issue_date, due_date, demand_amount, description, assigned_to, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insNotice.run(
    1, 'FORM GST ASMT-10', 'ZD241025049182K', 'Section 61 — Scrutiny of Returns',
    '2025-10-12', '2025-11-11', 38400,
    'GSTR-3B Table 4(A)(5) vs GSTR-2B ITC variance inquiry for Q1 FY 2025-26.',
    'Neha Kulkarni', 'Drafting Reply'
  );
  insNotice.run(
    1, 'FORM GST DRC-01A', 'ZD240925011840M', 'Section 73(5) — Pre-Show Cause Intimation',
    '2025-09-28', '2025-11-04', 19250,
    'Interest u/s 50(1) calculation verification on delayed May return.',
    'CA Siddharth Mehta', 'Open'
  );

  // TaxOne Chat Threads & Messages
  const insThread = db.prepare(`
    INSERT INTO chat_threads (company_id, client_name, whatsapp_number, assigned_member, unread_count, last_message, last_timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insThread.run(1, 'Rajeshbhai (Suryavanshi Textiles)', '+91 98251 77420', 'Neha Kulkarni', 2, 'Attached October HDFC statement & 2 purchase bills PDF.', '10:42 AM');
  insThread.run(2, 'Vikramaditya (Kamdhenu LLP)', '+91 98204 51902', 'Rohan Prajapati', 0, 'Approved GSTR-3B PMT-06 challan amount on WhatsApp.', 'Yesterday');
  insThread.run(3, 'Karthik (Bharath Cloud Retail)', '+91 98450 66189', 'Ananya Iyer', 1, 'Sharing Amazon B2B MTR October CSV export.', 'Oct 24');

  const insMsg = db.prepare(`
    INSERT INTO chat_messages (thread_id, sender_type, sender_name, body, attachment_name, forwarded_module, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insMsg.run(1, 'firm', 'Neha Kulkarni (GST Desk)', 'Namaste Rajeshbhai! Automated reminder: Please share October purchase bills & HDFC bank statement for GSTR-2B IMS reconciliation before 11th.', '', '', '09:15 AM');
  insMsg.run(1, 'client', 'Rajeshbhai Suryavanshi', 'Shared HDFC Current A/c Oct Excel export here.', 'HDFC_Oct2025_Supplementary.xlsx', 'Banking', '10:39 AM');
  insMsg.run(1, 'client', 'Rajeshbhai Suryavanshi', 'Attached October HDFC statement & 2 purchase bills PDF. Also check Pune Precision Looms invoice PPL-2025-0774.', 'Pune_Precision_Invoice_774.pdf', '', '10:42 AM');
  insMsg.run(2, 'client', 'Vikramaditya Deshpande', 'Approved GSTR-3B PMT-06 challan amount on WhatsApp.', '', '', 'Yesterday');
  insMsg.run(3, 'client', 'Karthik Subramanian', 'Sharing Amazon B2B MTR October CSV export.', 'Amazon_MTR_B2B_Oct2025.csv', 'Sales', 'Oct 24');

  // Reminder Templates & Scheduled Reminders
  const insTpl = db.prepare('INSERT INTO reminder_templates (title, category, channel, body_template) VALUES (?, ?, ?, ?)');
  insTpl.run('Monthly Purchase Bills & Bank Statement Collection', 'Data Collection', 'WhatsApp + Email', 'Dear {{client_name}}, kindly upload your {{month}} Bank Statement & Purchase Invoices on Vyapar TaxOne Chat before the 5th for timely GSTR-1 & GSTR-2B reconciliation.');
  insTpl.run('Supplier GSTR-1 Non-Filing Follow-up (IMS Risk)', 'GST Compliance', 'WhatsApp', 'Attention {{vendor_name}} ({{gstin}}): Invoice {{invoice_no}} dated {{date}} is not yet reflected in our GSTR-2B. Kindly file GSTR-1 to avoid payment hold.');
  insTpl.run('GSTR-3B PMT-06 Cash Challan Approval', 'Return Filing', 'WhatsApp + Email', 'Dear {{client_name}}, your GSTR-3B summary for {{month}} is ready. Net Cash Challan payable after Rule 88A ITC offset is ₹{{cash_payable}}.');

  const insRem = db.prepare('INSERT INTO scheduled_reminders (company_id, template_title, channel, frequency, next_run_date, status) VALUES (?, ?, ?, ?, ?, ?)');
  insRem.run(1, 'Monthly Purchase Bills & Bank Statement Collection', 'WhatsApp + Email', 'Monthly (3rd of Month)', '2025-11-03', 'Scheduled');
  insRem.run(1, 'Supplier GSTR-1 Non-Filing Follow-up (IMS Risk)', 'WhatsApp', 'Monthly (14th post GSTR-2B)', '2025-11-14', 'Scheduled');

  // PMS Tasks
  const insTask = db.prepare(`
    INSERT INTO pms_tasks (company_id, title, task_category, assignee, priority, status, due_date, linked_module)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insTask.run(1, 'Verify 3 Smart GST Validation Errors before GSTR-1 JSON export', 'GST Filing', 'Neha Kulkarni', 'Urgent', 'In Progress', '2025-11-10', 'GST Automation');
  insTask.run(1, 'Knock off 2 Unmapped HDFC Bank Entries & Remove 1 Duplicate Row', 'Document Task', 'Rohan Prajapati', 'High', 'Todo', '2025-11-05', 'Banking');
  insTask.run(1, 'Follow up with Pune Precision Looms on ₹32,400 Missing GSTR-2B ITC', 'GST Filing', 'Neha Kulkarni', 'High', 'In Progress', '2025-11-08', 'IMS Reconciliation');
  insTask.run(1, 'Submit ASMT-10 Scrutiny Reconciliation Reply (ZD241025049182K)', 'Audit', 'CA Siddharth Mehta', 'Urgent', 'In Progress', '2025-11-11', 'Notice Tracker');
  insTask.run(2, 'Generate & Push Kamdhenu October Purchase Register to TallyPrime', 'General Task', 'Ananya Iyer', 'Medium', 'Completed', '2025-10-28', 'Data Automation');

  // Drive Documents
  const insDoc = db.prepare(`
    INSERT INTO drive_documents (company_id, file_name, folder_category, file_size, uploaded_by, uploaded_at, transfer_status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insDoc.run(1, 'HDFC_Oct2025_Statement.xlsx', 'Bank Statements', '412 KB', 'Rajeshbhai (WhatsApp)', '2025-10-26', 'Active');
  insDoc.run(1, 'GSTR2B_24AABCS9142G1Z_102025.json', 'GST Returns & JSON', '186 KB', 'GSTN Portal Auto-Fetch', '2025-10-25', 'Active');
  insDoc.run(1, 'Pune_Precision_Invoice_774.pdf', 'Purchase Invoices', '890 KB', 'Rajeshbhai (WhatsApp)', '2025-10-26', 'Pending Approval');
  insDoc.run(1, 'Suryavanshi_FY24-25_TaxAudit_3CD_Signed.pdf', 'Statutory Audit Vault', '2.4 MB', 'CA Siddharth Mehta', '2025-09-30', 'Active');

  // Activity Logs
  const insLog = db.prepare('INSERT INTO activity_logs (company_id, actor, module, action) VALUES (?, ?, ?, ?)');
  insLog.run(1, 'Rohan Prajapati', 'Tally Connector', 'Synced 14 Sales & Bank Vouchers to Suryavanshi Precision Textiles FY 25-26');
  insLog.run(1, 'Neha Kulkarni', 'IMS Reconciliation', 'Rejected unauthorized GSTR-2B invoice DEL/CAT/1102 (₹3,240 IGST)');
  insLog.run(1, 'System Rule Engine', 'Banking Automation', 'Auto-categorized 5 HDFC rows & flagged 1 duplicate DGVCL entry');
}
