export type VoucherType =
  | 'Sales'
  | 'Purchase'
  | 'Credit Note'
  | 'Debit Note'
  | 'Journal'
  | 'Payment'
  | 'Receipt'
  | 'Contra';

export type SourceMode =
  | 'Bulk Excel'
  | 'OCR Scan'
  | 'Manual Cloud'
  | 'Banking'
  | 'Vyapar App'
  | 'E-Commerce';

export type TallySyncStatus = 'Pending' | 'Reviewed' | 'Pushed to Tally' | 'Error';

export interface CompanyRecord {
  id: number;
  name: string;
  trade_name: string;
  gstin: string;
  pan: string;
  state_code: string;
  state_name: string;
  financial_year: string;
  tally_company_name: string;
  tally_connector_port: number;
  tally_sync_status: string;
  last_tally_sync: string;
  gst_portal_connected: number;
  gst_username: string;
  credit_ledger_igst: number;
  credit_ledger_cgst: number;
  credit_ledger_sgst: number;
  books_source: 'TallyPrime' | 'Vyapar App' | 'Tally + Vyapar';
}

export interface VoucherLineItem {
  item_name: string;
  hsn_code: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
  gst_rate: number;
}

export interface VoucherRecord {
  id: number;
  company_id: number;
  voucher_type: VoucherType;
  voucher_no: string;
  voucher_date: string;
  party_name: string;
  party_gstin: string;
  ledger_name: string;
  counter_ledger: string;
  place_of_supply: string;
  hsn_code: string;
  gst_rate: number;
  taxable_value: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  total_amount: number;
  is_rcm: number;
  ecommerce_gstin: string;
  original_invoice_no: string;
  narration: string;
  source_mode: SourceMode;
  tally_status: TallySyncStatus;
  line_items_json: string;
}

export interface PortalInvoiceRecord {
  id: number;
  company_id: number;
  return_type: 'GSTR-1' | 'GSTR-2A' | 'GSTR-2B';
  period: string;
  counterparty_gstin: string;
  counterparty_name: string;
  invoice_no: string;
  invoice_date: string;
  place_of_supply: string;
  gst_rate: number;
  taxable_value: number;
  igst: number;
  cgst: number;
  sgst: number;
  total_amount: number;
  filing_status: 'Filed' | 'Not Filed';
  ims_status: 'Pending' | 'Accepted' | 'Rejected';
}

export interface LedgerRecord {
  id: number;
  company_id: number;
  name: string;
  parent_group: string;
  gstin: string;
  state_name: string;
  opening_balance: number;
  tally_synced: number;
}

export interface StockItemRecord {
  id: number;
  company_id: number;
  name: string;
  base_unit: string;
  hsn_code: string;
  gst_rate: number;
  opening_qty: number;
  opening_value: number;
  tally_synced: number;
}

export interface BankRuleRecord {
  id: number;
  company_id: number;
  rule_name: string;
  keyword_pattern: string;
  direction: 'Withdrawal' | 'Deposit' | 'Both';
  voucher_type: 'Payment' | 'Receipt' | 'Contra';
  target_ledger: string;
  priority: number;
  active: number;
  matched_count: number;
}

export interface BankTransactionRecord {
  id: number;
  company_id: number;
  bank_ledger: string;
  tx_date: string;
  narration: string;
  cheque_ref_no: string;
  withdrawal: number;
  deposit: number;
  closing_balance: number;
  voucher_type: 'Payment' | 'Receipt' | 'Contra';
  mapped_ledger: string;
  status: 'Unmapped' | 'Auto-Mapped' | 'Reviewed' | 'Pushed to Tally';
  is_duplicate: number;
  source_file: string;
}
