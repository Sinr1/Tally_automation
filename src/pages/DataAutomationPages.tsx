import {
  Copy,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  ScanLine,
  Trash2,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { WorkspaceLayout } from '../components/WorkspaceLayout.tsx';
import { useWorkspace } from '../context/WorkspaceContext.tsx';

interface LedgerRow {
  id: number;
  name: string;
  parent_group: string;
  gstin: string;
  state_name: string;
  opening_balance: number;
  tally_synced: number;
}

interface StockItemRow {
  id: number;
  name: string;
  base_unit: string;
  hsn_code: string;
  gst_rate: number;
  opening_qty: number;
  opening_value: number;
  tally_synced: number;
}

interface BankTxRow {
  id: number;
  bank_ledger: string;
  tx_date: string;
  narration: string;
  cheque_ref_no: string;
  withdrawal: number;
  deposit: number;
  closing_balance: number;
  voucher_type: 'Payment' | 'Receipt' | 'Contra';
  mapped_ledger: string;
  status: string;
  is_duplicate: number;
  source_file: string;
}

interface BankRuleRow {
  id: number;
  rule_name: string;
  keyword_pattern: string;
  direction: string;
  voucher_type: string;
  target_ledger: string;
  priority: number;
  matched_count: number;
}

interface VoucherRow {
  id: number;
  voucher_type: string;
  voucher_no: string;
  voucher_date: string;
  party_name: string;
  party_gstin: string;
  ledger_name: string;
  place_of_supply: string;
  hsn_code: string;
  gst_rate: number;
  taxable_value: number;
  igst: number;
  cgst: number;
  sgst: number;
  total_amount: number;
  source_mode: string;
  tally_status: string;
}

const SAMPLE_BANK_OVERLAP_CSV = `Date,Narration,Ref No,Withdrawal,Deposit,Balance
2025-10-09,BIL/00948210/DGVCL INDUSTRIAL HT POWER BILL OCT,DGVCL-REUPLOAD,46850,0,1391050
2025-10-27,RTGS CR-PATEL SYNTHETICS AND YARNS-INV105,HDFCR520251027,0,188000,1981901
2025-10-28,SALARY OCT PAYROLL NEFT SURAT PLANT,SAL-OCT25,215000,0,1766901
2025-10-29,UPI/884120/BLUE DART COURIER PARCEL,UPI884120,1450,0,1765451`;

const SAMPLE_AMAZON_SALES_CSV = `Invoice_No,Invoice_Date,Customer_Name,Customer_GSTIN,State_POS,HSN,GST_Slab,Taxable_Amount
AMZ/B2B/901,2025-10-24,Patel Synthetics & Yarns Ltd,24AAACP4120H1ZN,24-Gujarat,540247,18,125000
AMZ/B2B/902,2025-10-25,Tata Industrial Fabrics Ltd,27AABCT3518Q1ZV,27-Maharashtra,540752,18,210000
AMZ/B2C/903,2025-10-26,Amazon Retail Buyer Bengaluru,,29-Karnataka,853710,18,42000`;

export function BankingAutomationPage() {
  const { activeCompany, activeCompanyId, showToast, setXmlModal } = useWorkspace();
  const [txns, setTxns] = useState<BankTxRow[]>([]);
  const [ledgers, setLedgers] = useState<LedgerRow[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const loadData = useCallback(async () => {
    const [tRes, lRes] = await Promise.all([
      fetch(`/api/banking/transactions?companyId=${activeCompanyId}`),
      fetch(`/api/ledgers?companyId=${activeCompanyId}`),
    ]);
    if (tRes.ok) {
      const d = (await tRes.json()) as { transactions: BankTxRow[] };
      setTxns(d.transactions);
    }
    if (lRes.ok) {
      const d = (await lRes.json()) as { ledgers: LedgerRow[] };
      setLedgers(d.ledgers);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    const res = await fetch('/api/banking/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: activeCompanyId,
        filename: file.name,
        content: base64,
        encoding: 'base64',
      }),
    });
    if (res.ok) {
      const info = (await res.json()) as {
        importedCount: number;
        autoMappedCount: number;
        duplicateCount: number;
      };
      showToast(
        `Imported ${info.importedCount} rows (${info.autoMappedCount} auto-mapped, ${info.duplicateCount} duplicates flagged)`
      );
      void loadData();
    }
    e.target.value = '';
  };

  const handleLoadSampleStatement = async () => {
    const res = await fetch('/api/banking/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: activeCompanyId,
        filename: 'HDFC_LateOct_Sample.csv',
        content: SAMPLE_BANK_OVERLAP_CSV,
        encoding: 'utf8',
      }),
    });
    if (res.ok) {
      const info = (await res.json()) as {
        importedCount: number;
        autoMappedCount: number;
        duplicateCount: number;
      };
      showToast(
        `Sample loaded: ${info.importedCount} rows (${info.autoMappedCount} auto-mapped by Smart Rules, ${info.duplicateCount} duplicate caught!)`
      );
      void loadData();
    }
  };

  const handleApplyRules = async () => {
    const res = await fetch('/api/banking/apply-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: activeCompanyId }),
    });
    if (res.ok) {
      const d = (await res.json()) as { matchedCount: number };
      showToast(`Smart Rules categorized ${d.matchedCount} unmapped row(s)`);
      void loadData();
    }
  };

  const handleInlineUpdate = async (
    id: number,
    patch: Partial<Pick<BankTxRow, 'mapped_ledger' | 'voucher_type'>>
  ) => {
    await fetch(`/api/banking/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    void loadData();
  };

  const handleDeleteRow = async (id: number) => {
    await fetch(`/api/banking/transactions/${id}`, { method: 'DELETE' });
    showToast('Removed bank transaction row');
    void loadData();
  };

  const handlePushBankToTally = async () => {
    const res = await fetch('/api/tally/sync/banking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: activeCompanyId }),
    });
    if (res.ok) {
      const d = (await res.json()) as {
        syncedCount: number;
        filename: string;
        xml: string;
        bridge: { statusMessage: string };
      };
      showToast(`Synced ${d.syncedCount} non-duplicate bank entries to TallyPrime`);
      setXmlModal({
        title: `Banking Vouchers <ENVELOPE> (${d.syncedCount} Entries)`,
        filename: d.filename,
        xml: d.xml,
        subtitle: `${d.bridge.statusMessage} (Duplicates automatically excluded)`,
      });
      void loadData();
    }
  };

  const visibleTxns = txns.filter((t) => {
    if (filterStatus === 'UNMAPPED') return t.status === 'Unmapped';
    if (filterStatus === 'DUPLICATES') return t.is_duplicate === 1;
    return true;
  });

  return (
    <WorkspaceLayout>
      <div className="ws-page-header">
        <div>
          <h1 className="ws-page-title">Banking Statement Automation</h1>
          <p className="ws-page-sub">
            Upload Excel/CSV bank statements for <strong>{activeCompany?.trade_name}</strong>, run
            Smart Keyword Rules, catch duplicate overlaps, and push to TallyPrime.
          </p>
        </div>

        <div className="ws-header-actions">
          <label className="btn btn-secondary">
            <Upload size={14} /> Upload .XLSX / .CSV
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => void handleFileUpload(e)}
              style={{ display: 'none' }}
            />
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void handleLoadSampleStatement()}
          >
            <FileSpreadsheet size={14} /> Load Sample Overlap CSV
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void handleApplyRules()}
          >
            <RefreshCw size={14} /> Run Smart Rules
          </button>
          <button
            type="button"
            className="btn btn-cobalt"
            onClick={() => void handlePushBankToTally()}
          >
            Push Mapped to Tally XML
          </button>
        </div>
      </div>

      <div className="kpi-strip">
        <div className="kpi-cell">
          <div className="kpi-label">Statement Rows</div>
          <div className="kpi-value">{txns.length}</div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-label">Auto-Mapped / Reviewed</div>
          <div className="kpi-value">
            {txns.filter((t) => t.mapped_ledger !== '').length}
          </div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-label">Unmapped Suspense</div>
          <div className="kpi-value" style={{ color: '#b45309' }}>
            {txns.filter((t) => t.status === 'Unmapped').length}
          </div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-label">Duplicate Guard Alerts</div>
          <div className="kpi-value" style={{ color: '#c2410c' }}>
            {txns.filter((t) => t.is_duplicate === 1).length}
          </div>
        </div>
      </div>

      <div className="ws-card">
        <div className="ws-card-head">
          <h3>HDFC / ICICI Statement Workbench</h3>
          <div className="sub-tabs">
            <button
              type="button"
              className={`sub-tab ${filterStatus === 'ALL' ? 'active' : ''}`}
              onClick={() => setFilterStatus('ALL')}
            >
              All ({txns.length})
            </button>
            <button
              type="button"
              className={`sub-tab ${filterStatus === 'UNMAPPED' ? 'active' : ''}`}
              onClick={() => setFilterStatus('UNMAPPED')}
            >
              Unmapped ({txns.filter((t) => t.status === 'Unmapped').length})
            </button>
            <button
              type="button"
              className={`sub-tab ${filterStatus === 'DUPLICATES' ? 'active' : ''}`}
              onClick={() => setFilterStatus('DUPLICATES')}
            >
              Orange-Flag Duplicates ({txns.filter((t) => t.is_duplicate === 1).length})
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Narration &amp; UTR</th>
                <th className="num">Withdrawal (Dr)</th>
                <th className="num">Deposit (Cr)</th>
                <th>Vch Type</th>
                <th>Tally Target Ledger</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleTxns.map((tx) => (
                <tr key={tx.id} className={tx.is_duplicate ? 'dup-row' : ''}>
                  <td className="mono">{tx.tx_date}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{tx.narration}</div>
                    <div className="mono" style={{ color: '#64748b' }}>
                      {tx.cheque_ref_no} · {tx.source_file}
                    </div>
                  </td>
                  <td className="num">
                    {tx.withdrawal > 0 ? `₹${tx.withdrawal.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="num" style={{ color: tx.deposit > 0 ? '#15803d' : undefined }}>
                    {tx.deposit > 0 ? `₹${tx.deposit.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td>
                    <select
                      className="inline-select"
                      value={tx.voucher_type}
                      onChange={(e) =>
                        void handleInlineUpdate(tx.id, {
                          voucher_type: e.target.value as BankTxRow['voucher_type'],
                        })
                      }
                    >
                      <option value="Payment">Payment</option>
                      <option value="Receipt">Receipt</option>
                      <option value="Contra">Contra</option>
                    </select>
                  </td>
                  <td>
                    <select
                      className="inline-select"
                      value={tx.mapped_ledger}
                      onChange={(e) =>
                        void handleInlineUpdate(tx.id, { mapped_ledger: e.target.value })
                      }
                    >
                      <option value="">-- Select Tally Ledger --</option>
                      {ledgers.map((l) => (
                        <option key={l.id} value={l.name}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {tx.is_duplicate ? (
                      <span className="badge badge-warn">Duplicate Blocked</span>
                    ) : tx.status === 'Pushed to Tally' ? (
                      <span className="badge badge-ok">Pushed to Tally</span>
                    ) : tx.mapped_ledger ? (
                      <span className="badge badge-info">{tx.status}</span>
                    ) : (
                      <span className="badge badge-err">Unmapped</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => void handleDeleteRow(tx.id)}
                      title="Delete row"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </WorkspaceLayout>
  );
}

export function BankRulesPage() {
  const { companies, activeCompanyId, showToast } = useWorkspace();
  const [rules, setRules] = useState<BankRuleRow[]>([]);
  const [ledgers, setLedgers] = useState<LedgerRow[]>([]);
  const [ruleName, setRuleName] = useState('');
  const [pattern, setPattern] = useState('');
  const [direction, setDirection] = useState('Withdrawal');
  const [voucherType, setVoucherType] = useState('Payment');
  const [targetLedger, setTargetLedger] = useState('');
  const [cloneSourceId, setCloneSourceId] = useState(1);

  const loadRules = useCallback(async () => {
    const [rRes, lRes] = await Promise.all([
      fetch(`/api/banking/rules?companyId=${activeCompanyId}`),
      fetch(`/api/ledgers?companyId=${activeCompanyId}`),
    ]);
    if (rRes.ok) {
      const d = (await rRes.json()) as { rules: BankRuleRow[] };
      setRules(d.rules);
    }
    if (lRes.ok) {
      const d = (await lRes.json()) as { ledgers: LedgerRow[] };
      setLedgers(d.ledgers);
      if (d.ledgers[0] && !targetLedger) setTargetLedger(d.ledgers[0].name);
    }
  }, [activeCompanyId, targetLedger]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const handleAddRule = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/banking/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: activeCompanyId,
        rule_name: ruleName,
        keyword_pattern: pattern,
        direction,
        voucher_type: voucherType,
        target_ledger: targetLedger,
        priority: rules.length + 1,
      }),
    });
    if (res.ok) {
      setRuleName('');
      setPattern('');
      showToast('Smart Keyword Rule saved');
      void loadRules();
    }
  };

  const handleCloneRules = async () => {
    const res = await fetch('/api/banking/rules/clone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromCompanyId: cloneSourceId,
        toCompanyId: activeCompanyId,
      }),
    });
    if (res.ok) {
      const d = (await res.json()) as { cloned: number };
      showToast(`Cloned ${d.cloned} smart bank rules into active company`);
      void loadRules();
    }
  };

  return (
    <WorkspaceLayout>
      <div className="ws-page-header">
        <div>
          <h1 className="ws-page-title">Smart Banking Categorization Rules</h1>
          <p className="ws-page-sub">
            Auto-map recurring NEFT/RTGS/UPI narrations to Tally ledgers and clone rules across clients.
          </p>
        </div>

        <div className="ws-header-actions">
          <select
            className="inline-select"
            value={cloneSourceId}
            onChange={(e) => setCloneSourceId(Number(e.target.value))}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                Clone from: {c.trade_name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void handleCloneRules()}
          >
            <Copy size={13} /> Clone Rules Here
          </button>
        </div>
      </div>

      <div className="ws-card">
        <div className="ws-card-head">
          <h3>Create Narration Keyword Rule</h3>
        </div>
        <div className="ws-card-body">
          <form onSubmit={(e) => void handleAddRule(e)} className="form-grid">
            <div className="field">
              <label>Rule Name</label>
              <input
                className="input"
                placeholder="e.g. Blue Dart Freight"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Keywords (Pipe | separated)</label>
              <input
                className="input mono"
                placeholder="BLUE DART|DELHIVERY|COURIER"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Flow Direction</label>
              <select
                className="select"
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
              >
                <option value="Withdrawal">Withdrawal (Debit)</option>
                <option value="Deposit">Deposit (Credit)</option>
                <option value="Both">Both</option>
              </select>
            </div>
            <div className="field">
              <label>Voucher Type</label>
              <select
                className="select"
                value={voucherType}
                onChange={(e) => setVoucherType(e.target.value)}
              >
                <option value="Payment">Payment</option>
                <option value="Receipt">Receipt</option>
                <option value="Contra">Contra</option>
              </select>
            </div>
            <div className="field">
              <label>Target Tally Ledger</label>
              <select
                className="select"
                value={targetLedger}
                onChange={(e) => setTargetLedger(e.target.value)}
              >
                {ledgers.map((l) => (
                  <option key={l.id} value={l.name}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-cobalt">
                <Plus size={14} /> Save Rule
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="ws-card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Rule Name</th>
                <th>Keyword Pattern</th>
                <th>Direction</th>
                <th>Voucher</th>
                <th>Target Tally Ledger</th>
                <th className="num">Hits</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td className="mono">#{r.priority}</td>
                  <td style={{ fontWeight: 700 }}>{r.rule_name}</td>
                  <td className="mono">{r.keyword_pattern}</td>
                  <td>{r.direction}</td>
                  <td>
                    <span className="badge badge-info">{r.voucher_type}</span>
                  </td>
                  <td>{r.target_ledger}</td>
                  <td className="num">{r.matched_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </WorkspaceLayout>
  );
}

export function SalesPurchaseWorkbenchPage({
  mode,
}: {
  mode: 'Sales' | 'Purchase';
}) {
  const { activeCompany, activeCompanyId, showToast, setXmlModal } = useWorkspace();
  const [subTab, setSubTab] = useState<'register' | 'wizard' | 'ocr'>('register');
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);

  // 3-Step Bulk Excel Mapping Wizard state
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string | number>[]>([]);
  const [mapVoucherNo, setMapVoucherNo] = useState('Invoice_No');
  const [mapDate, setMapDate] = useState('Invoice_Date');
  const [mapParty, setMapParty] = useState('Customer_Name');
  const [mapGstin, setMapGstin] = useState('Customer_GSTIN');
  const [mapPos, setMapPos] = useState('State_POS');
  const [mapHsn, setMapHsn] = useState('HSN');
  const [mapRate, setMapRate] = useState('GST_Slab');
  const [mapTaxable, setMapTaxable] = useState('Taxable_Amount');
  const [gstAutoCalc, setGstAutoCalc] = useState(true);

  // Split-pane OCR state
  const [ocrText, setOcrText] = useState(
    `TAX INVOICE\nM/s: Shreeji Precision Hydraulics Pvt Ltd\nGSTIN: 24AABCS7842K1ZP\nINV NO: SPH/25-26/4410\nDate: 2025-10-24\nHSN: 847130\nTaxable Amount: ₹64,000.00`
  );
  const [ocrResult, setOcrResult] = useState<{
    confidence: number;
    voucherNo: string;
    voucherDate: string;
    partyName: string;
    partyGstin: string;
    placeOfSupply: string;
    hsnCode: string;
    gstRate: number;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    totalAmount: number;
  } | null>(null);

  const loadVouchers = useCallback(async () => {
    const res = await fetch(
      `/api/vouchers?companyId=${activeCompanyId}&voucherType=${mode}`
    );
    if (res.ok) {
      const d = (await res.json()) as { vouchers: VoucherRow[] };
      setVouchers(d.vouchers);
    }
  }, [activeCompanyId, mode]);

  useEffect(() => {
    void loadVouchers();
  }, [loadVouchers]);

  const handleSyncToTally = async () => {
    const ids = vouchers.map((v) => v.id);
    const res = await fetch('/api/tally/sync/vouchers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: activeCompanyId, voucherIds: ids }),
    });
    if (res.ok) {
      const d = (await res.json()) as {
        syncedCount: number;
        filename: string;
        xml: string;
        bridge: { statusMessage: string };
      };
      showToast(`Generated Tally XML for ${d.syncedCount} ${mode} vouchers`);
      setXmlModal({
        title: `${mode} Register Tally <ENVELOPE> (${d.syncedCount} Vouchers)`,
        filename: d.filename,
        xml: d.xml,
        subtitle: d.bridge.statusMessage,
      });
      void loadVouchers();
    }
  };

  const loadSampleBulkSheet = async () => {
    const res = await fetch('/api/vouchers/parse-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: `Sample_${mode}_MTR_Oct2025.csv`,
        content: SAMPLE_AMAZON_SALES_CSV,
        encoding: 'utf8',
      }),
    });
    if (res.ok) {
      const d = (await res.json()) as {
        headers: string[];
        allRows: Record<string, string | number>[];
      };
      setParsedHeaders(d.headers);
      setParsedRows(d.allRows);
      showToast(`Parsed ${d.allRows.length} spreadsheet rows — verify column mapping below`);
    }
  };

  const handleSheetFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const res = await fetch('/api/vouchers/parse-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        content: btoa(bin),
        encoding: 'base64',
      }),
    });
    if (res.ok) {
      const d = (await res.json()) as {
        headers: string[];
        allRows: Record<string, string | number>[];
      };
      setParsedHeaders(d.headers);
      setParsedRows(d.allRows);
      if (d.headers[0]) setMapVoucherNo(d.headers[0]);
      if (d.headers[1]) setMapDate(d.headers[1]);
      if (d.headers[2]) setMapParty(d.headers[2]);
    }
    e.target.value = '';
  };

  const handleExecuteBulkImport = async () => {
    const res = await fetch('/api/vouchers/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: activeCompanyId,
        voucherType: mode,
        rows: parsedRows,
        mapping: {
          voucherNoCol: mapVoucherNo,
          voucherDateCol: mapDate,
          partyNameCol: mapParty,
          partyGstinCol: mapGstin,
          posCol: mapPos,
          hsnCol: mapHsn,
          gstRateCol: mapRate,
          taxableCol: mapTaxable,
          ledgerName: mode === 'Sales' ? 'Sales GST 18%' : 'Purchase GST 18%',
          gstAutoCalculate: gstAutoCalc,
          sourceMode: 'E-Commerce',
        },
      }),
    });
    if (res.ok) {
      const d = (await res.json()) as { importedCount: number };
      showToast(`Imported ${d.importedCount} ${mode} vouchers with auto CGST/SGST/IGST split!`);
      setParsedRows([]);
      setSubTab('register');
      void loadVouchers();
    }
  };

  const handleRunOcr = async () => {
    const res = await fetch('/api/vouchers/ocr-extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: activeCompanyId,
        filename: `${mode}_Invoice_Scan.pdf`,
        rawText: ocrText,
        voucherType: mode,
      }),
    });
    if (res.ok) {
      const d = (await res.json()) as { extracted: NonNullable<typeof ocrResult> };
      setOcrResult(d.extracted);
      showToast(`OCR extracted ${d.extracted.voucherNo} (${d.extracted.confidence}% confidence)`);
    }
  };

  const handleSaveOcrVoucher = async () => {
    if (!ocrResult) return;
    const res = await fetch('/api/vouchers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: activeCompanyId,
        voucher_type: mode,
        voucher_no: ocrResult.voucherNo,
        voucher_date: ocrResult.voucherDate,
        party_name: ocrResult.partyName,
        party_gstin: ocrResult.partyGstin,
        place_of_supply: ocrResult.placeOfSupply,
        hsn_code: ocrResult.hsnCode,
        gst_rate: ocrResult.gstRate,
        taxable_value: ocrResult.taxableValue,
        igst: ocrResult.igst,
        cgst: ocrResult.cgst,
        sgst: ocrResult.sgst,
        total_amount: ocrResult.totalAmount,
        source_mode: 'OCR Scan',
      }),
    });
    if (res.ok) {
      showToast(`Saved OCR-verified ${mode} voucher ${ocrResult.voucherNo}`);
      setOcrResult(null);
      setSubTab('register');
      void loadVouchers();
    }
  };

  return (
    <WorkspaceLayout>
      <div className="ws-page-header">
        <div>
          <h1 className="ws-page-title">
            {mode} Automation — Bulk Excel, E-Commerce &amp; AI OCR
          </h1>
          <p className="ws-page-sub">
            Active Books: <strong>{activeCompany?.name}</strong> ({activeCompany?.state_code}-
            {activeCompany?.state_name})
          </p>
        </div>

        <div className="ws-header-actions">
          <div className="sub-tabs">
            <button
              type="button"
              className={`sub-tab ${subTab === 'register' ? 'active' : ''}`}
              onClick={() => setSubTab('register')}
            >
              1. {mode} Register ({vouchers.length})
            </button>
            <button
              type="button"
              className={`sub-tab ${subTab === 'wizard' ? 'active' : ''}`}
              onClick={() => setSubTab('wizard')}
            >
              2. Bulk Excel / Amazon Wizard
            </button>
            <button
              type="button"
              className={`sub-tab ${subTab === 'ocr' ? 'active' : ''}`}
              onClick={() => setSubTab('ocr')}
            >
              3. Split-Pane Bill OCR
            </button>
          </div>

          <button
            type="button"
            className="btn btn-cobalt"
            onClick={() => void handleSyncToTally()}
          >
            Sync {mode} to Tally XML
          </button>
        </div>
      </div>

      {subTab === 'register' && (
        <div className="ws-card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice No</th>
                  <th>Counterparty &amp; GSTIN</th>
                  <th>POS</th>
                  <th>HSN</th>
                  <th className="num">Taxable</th>
                  <th className="num">IGST</th>
                  <th className="num">CGST+SGST</th>
                  <th className="num">Total</th>
                  <th>Source</th>
                  <th>Tally</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v) => (
                  <tr key={v.id}>
                    <td className="mono">{v.voucher_date}</td>
                    <td className="mono" style={{ fontWeight: 700 }}>
                      {v.voucher_no}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{v.party_name}</div>
                      <div className="mono" style={{ color: '#64748b' }}>
                        {v.party_gstin || 'Unregistered B2C'}
                      </div>
                    </td>
                    <td>{v.place_of_supply}</td>
                    <td className="mono">{v.hsn_code || '—'}</td>
                    <td className="num">₹{v.taxable_value.toLocaleString('en-IN')}</td>
                    <td className="num">₹{v.igst.toLocaleString('en-IN')}</td>
                    <td className="num">₹{(v.cgst + v.sgst).toLocaleString('en-IN')}</td>
                    <td className="num" style={{ fontWeight: 700 }}>
                      ₹{v.total_amount.toLocaleString('en-IN')}
                    </td>
                    <td>
                      <span className="badge badge-neutral">{v.source_mode}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          v.tally_status === 'Pushed to Tally' ? 'badge-ok' : 'badge-info'
                        }`}
                      >
                        {v.tally_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'wizard' && (
        <div className="ws-card">
          <div className="ws-card-head">
            <h3>3-Step Excel / E-Commerce (Amazon, Flipkart, Meesho) to Tally Mapping Wizard</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <label className="btn btn-secondary btn-sm">
                <Upload size={14} /> Upload .XLSX / .CSV
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => void handleSheetFileUpload(e)}
                  style={{ display: 'none' }}
                />
              </label>
              <button
                type="button"
                className="btn btn-cobalt btn-sm"
                onClick={() => void loadSampleBulkSheet()}
              >
                <FileSpreadsheet size={14} /> Load Sample Amazon B2B/B2C Sheet
              </button>
            </div>
          </div>

          <div className="ws-card-body">
            {parsedRows.length === 0 ? (
              <p style={{ color: '#475569', margin: 0 }}>
                Upload any Sales, Purchase, or E-Commerce MTR spreadsheet — or click{' '}
                <strong>Load Sample Amazon B2B/B2C Sheet</strong> — to map spreadsheet columns to
                TallyPrime GST fields.
              </p>
            ) : (
              <>
                <div className="form-grid" style={{ marginBottom: '16px' }}>
                  {[
                    ['Invoice No Column', mapVoucherNo, setMapVoucherNo],
                    ['Invoice Date Column', mapDate, setMapDate],
                    ['Party Name Column', mapParty, setMapParty],
                    ['Party GSTIN Column', mapGstin, setMapGstin],
                    ['Place of Supply Column', mapPos, setMapPos],
                    ['HSN Code Column', mapHsn, setMapHsn],
                    ['GST Slab % Column', mapRate, setMapRate],
                    ['Taxable Value Column', mapTaxable, setMapTaxable],
                  ].map(([label, val, setter]) => (
                    <div key={String(label)} className="field">
                      <label>{String(label)}</label>
                      <select
                        className="select"
                        value={String(val)}
                        onChange={(e) =>
                          (setter as (s: string) => void)(e.target.value)
                        }
                      >
                        {parsedHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '14px',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={gstAutoCalc}
                      onChange={(e) => setGstAutoCalc(e.target.checked)}
                    />
                    GST Auto-Calculation (Split CGST+SGST for {activeCompany?.state_code}-
                    {activeCompany?.state_name}, IGST for Inter-State)
                  </label>
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => void handleExecuteBulkImport()}
                  >
                    Import {parsedRows.length} Mapped Vouchers into Books
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {subTab === 'ocr' && (
        <div className="split-two">
          <div className="ws-card">
            <div className="ws-card-head">
              <h3>Scanned Invoice / PDF Text Input</h3>
              <button
                type="button"
                className="btn btn-cobalt btn-sm"
                onClick={() => void handleRunOcr()}
              >
                <ScanLine size={14} /> Run AI OCR Extraction
              </button>
            </div>
            <div className="ws-card-body">
              <textarea
                className="textarea mono"
                rows={10}
                style={{ width: '100%' }}
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
              />
            </div>
          </div>

          <div className="ws-card">
            <div className="ws-card-head">
              <h3>Verified Tally Voucher Fields</h3>
              {ocrResult ? (
                <span className="badge badge-ok">{ocrResult.confidence}% AI Confidence</span>
              ) : null}
            </div>
            <div className="ws-card-body">
              {!ocrResult ? (
                <p style={{ color: '#475569', margin: 0 }}>
                  Click <strong>Run AI OCR Extraction</strong> to parse GSTIN, Invoice No, HSN, POS,
                  and Intra/Inter GST heads.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <table className="data-table">
                    <tbody>
                      <tr>
                        <td>Invoice No &amp; Date</td>
                        <td className="mono">
                          {ocrResult.voucherNo} · {ocrResult.voucherDate}
                        </td>
                      </tr>
                      <tr>
                        <td>Counterparty</td>
                        <td>{ocrResult.partyName}</td>
                      </tr>
                      <tr>
                        <td>Detected GSTIN &amp; POS</td>
                        <td className="mono">
                          {ocrResult.partyGstin} ({ocrResult.placeOfSupply})
                        </td>
                      </tr>
                      <tr>
                        <td>HSN &amp; Taxable Value</td>
                        <td className="num">
                          HSN {ocrResult.hsnCode} · ₹{ocrResult.taxableValue.toLocaleString('en-IN')}
                        </td>
                      </tr>
                      <tr>
                        <td>Computed GST ({ocrResult.gstRate}%)</td>
                        <td className="num">
                          IGST ₹{ocrResult.igst} | CGST ₹{ocrResult.cgst} | SGST ₹{ocrResult.sgst}
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Total Voucher Value</strong>
                        </td>
                        <td className="num">
                          <strong>₹{ocrResult.totalAmount.toLocaleString('en-IN')}</strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => void handleSaveOcrVoucher()}
                  >
                    Save Verified {mode} Voucher to Books
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </WorkspaceLayout>
  );
}

export function ManualCloudVouchersPage() {
  const { activeCompany, activeCompanyId, showToast } = useWorkspace();
  const [vType, setVType] = useState('Journal');
  const [vNo, setVNo] = useState('JV/25-26/0091');
  const [vDate, setVDate] = useState('2025-10-26');
  const [partyName, setPartyName] = useState('Depreciation Account');
  const [counterLedger, setCounterLedger] = useState('Plant & Machinery Block');
  const [partyGstin, setPartyGstin] = useState('');
  const [hsnCode, setHsnCode] = useState('847130');
  const [gstRate, setGstRate] = useState(0);
  const [taxableValue, setTaxableValue] = useState(42000);
  const [narration, setNarration] = useState('Monthly adjustment entry created in TaxOne Cloud');

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/vouchers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: activeCompanyId,
        voucher_type: vType,
        voucher_no: vNo,
        voucher_date: vDate,
        party_name: partyName,
        party_gstin: partyGstin,
        ledger_name: partyName,
        counter_ledger: counterLedger,
        place_of_supply: `${activeCompany?.state_code || '24'}-${activeCompany?.state_name || 'Gujarat'}`,
        hsn_code: hsnCode,
        gst_rate: gstRate,
        taxable_value: taxableValue,
        narration,
        source_mode: 'Manual Cloud',
      }),
    });
    if (res.ok) {
      showToast(`Created ${vType} voucher ${vNo} in SQLite books`);
      setVNo(`VCH/${Math.floor(1000 + Math.random() * 9000)}`);
    }
  };

  return (
    <WorkspaceLayout>
      <div className="ws-page-header">
        <div>
          <h1 className="ws-page-title">Cloud Voucher Entry &amp; Journal Register</h1>
          <p className="ws-page-sub">
            Create Sales, Purchase, Credit/Debit Notes, Payment, Receipt, Contra, or balanced Journal vouchers directly in the cloud.
          </p>
        </div>
      </div>

      <div className="ws-card">
        <div className="ws-card-head">
          <h3>New Cloud Accounting Voucher</h3>
        </div>
        <div className="ws-card-body">
          <form onSubmit={(e) => void handleCreate(e)} className="form-grid">
            <div className="field">
              <label>Voucher Type</label>
              <select className="select" value={vType} onChange={(e) => setVType(e.target.value)}>
                {[
                  'Journal',
                  'Sales',
                  'Purchase',
                  'Credit Note',
                  'Debit Note',
                  'Payment',
                  'Receipt',
                  'Contra',
                ].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Voucher Number</label>
              <input
                className="input mono"
                value={vNo}
                onChange={(e) => setVNo(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Voucher Date</label>
              <input
                type="date"
                className="input"
                value={vDate}
                onChange={(e) => setVDate(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Debit / Party Ledger</label>
              <input
                className="input"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Credit / Counter Ledger</label>
              <input
                className="input"
                value={counterLedger}
                onChange={(e) => setCounterLedger(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Party GSTIN (Optional)</label>
              <input
                className="input mono"
                value={partyGstin}
                onChange={(e) => setPartyGstin(e.target.value.toUpperCase())}
              />
            </div>
            <div className="field">
              <label>HSN / SAC</label>
              <input
                className="input mono"
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value)}
              />
            </div>
            <div className="field">
              <label>GST Rate (%)</label>
              <select
                className="select"
                value={gstRate}
                onChange={(e) => setGstRate(Number(e.target.value))}
              >
                {[0, 5, 12, 18, 28].map((r) => (
                  <option key={r} value={r}>
                    {r}%
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Amount / Taxable Value (₹)</label>
              <input
                type="number"
                className="input"
                value={taxableValue}
                onChange={(e) => setTaxableValue(Number(e.target.value))}
                required
              />
            </div>
            <div className="field">
              <label>Narration</label>
              <input
                className="input"
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
              />
            </div>
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-cobalt">
                Save Cloud Voucher
              </button>
            </div>
          </form>
        </div>
      </div>
    </WorkspaceLayout>
  );
}

export function MastersManagementPage() {
  const { companies, activeCompany, activeCompanyId, showToast, setXmlModal } = useWorkspace();
  const [ledgers, setLedgers] = useState<LedgerRow[]>([]);
  const [items, setItems] = useState<StockItemRow[]>([]);
  const [tab, setTab] = useState<'ledgers' | 'items'>('ledgers');
  const [cloneFromId, setCloneFromId] = useState(1);

  // New Ledger fields
  const [lName, setLName] = useState('');
  const [lGroup, setLGroup] = useState('Sundry Debtors');
  const [lGstin, setLGstin] = useState('');

  // New Item fields
  const [iName, setIName] = useState('');
  const [iUnit, setIUnit] = useState('NOS');
  const [iHsn, setIHsn] = useState('847130');
  const [iRate, setIRate] = useState(18);

  const loadMasters = useCallback(async () => {
    const [lRes, iRes] = await Promise.all([
      fetch(`/api/ledgers?companyId=${activeCompanyId}`),
      fetch(`/api/items?companyId=${activeCompanyId}`),
    ]);
    if (lRes.ok) setLedgers(((await lRes.json()) as { ledgers: LedgerRow[] }).ledgers);
    if (iRes.ok) setItems(((await iRes.json()) as { items: StockItemRow[] }).items);
  }, [activeCompanyId]);

  useEffect(() => {
    void loadMasters();
  }, [loadMasters]);

  const handleAddLedger = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/ledgers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: activeCompanyId,
        name: lName,
        parent_group: lGroup,
        gstin: lGstin,
      }),
    });
    if (res.ok) {
      setLName('');
      setLGstin('');
      showToast('Created Tally Party/GL Ledger');
      void loadMasters();
    }
  };

  const handleAddItem = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: activeCompanyId,
        name: iName,
        base_unit: iUnit,
        hsn_code: iHsn,
        gst_rate: iRate,
      }),
    });
    if (res.ok) {
      setIName('');
      showToast('Created Tally Stock Item Master');
      void loadMasters();
    }
  };

  const handleClone = async () => {
    const endpoint = tab === 'ledgers' ? '/api/ledgers/clone' : '/api/items/clone';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromCompanyId: cloneFromId, toCompanyId: activeCompanyId }),
    });
    if (res.ok) {
      const d = (await res.json()) as { cloned: number };
      showToast(`Cloned ${d.cloned} ${tab} from company #${cloneFromId}`);
      void loadMasters();
    }
  };

  const handleExportMastersXml = async () => {
    const res = await fetch(`/api/tally/xml/masters?companyId=${activeCompanyId}`);
    if (res.ok) {
      const d = (await res.json()) as { filename: string; xml: string };
      setXmlModal({
        title: `TallyPrime All Masters <ENVELOPE> — ${activeCompany?.tally_company_name || ''}`,
        filename: d.filename,
        xml: d.xml,
      });
      void loadMasters();
    }
  };

  return (
    <WorkspaceLayout>
      <div className="ws-page-header">
        <div>
          <h1 className="ws-page-title">Tally Ledger &amp; Stock Item Masters</h1>
          <p className="ws-page-sub">
            Bulk-create Party Ledgers &amp; Stock Items, clone masters across client companies, and export Tally XML.
          </p>
        </div>

        <div className="ws-header-actions">
          <div className="sub-tabs">
            <button
              type="button"
              className={`sub-tab ${tab === 'ledgers' ? 'active' : ''}`}
              onClick={() => setTab('ledgers')}
            >
              Ledgers ({ledgers.length})
            </button>
            <button
              type="button"
              className={`sub-tab ${tab === 'items' ? 'active' : ''}`}
              onClick={() => setTab('items')}
            >
              Stock Items ({items.length})
            </button>
          </div>

          <select
            className="inline-select"
            value={cloneFromId}
            onChange={(e) => setCloneFromId(Number(e.target.value))}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                Clone from: {c.trade_name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void handleClone()}>
            <Copy size={13} /> Clone Masters
          </button>
          <button
            type="button"
            className="btn btn-cobalt btn-sm"
            onClick={() => void handleExportMastersXml()}
          >
            Generate Masters XML
          </button>
        </div>
      </div>

      {tab === 'ledgers' ? (
        <>
          <div className="ws-card">
            <div className="ws-card-body">
              <form onSubmit={(e) => void handleAddLedger(e)} className="form-grid">
                <div className="field">
                  <label>Ledger Name</label>
                  <input
                    className="input"
                    value={lName}
                    onChange={(e) => setLName(e.target.value)}
                    required
                    placeholder="Reliance Petrochemicals Ltd"
                  />
                </div>
                <div className="field">
                  <label>Tally Parent Group</label>
                  <select
                    className="select"
                    value={lGroup}
                    onChange={(e) => setLGroup(e.target.value)}
                  >
                    <option value="Sundry Debtors">Sundry Debtors</option>
                    <option value="Sundry Creditors">Sundry Creditors</option>
                    <option value="Sales Accounts">Sales Accounts</option>
                    <option value="Purchase Accounts">Purchase Accounts</option>
                    <option value="Indirect Expenses">Indirect Expenses</option>
                    <option value="Bank Accounts">Bank Accounts</option>
                  </select>
                </div>
                <div className="field">
                  <label>Party GSTIN (Auto-detects State)</label>
                  <input
                    className="input mono"
                    value={lGstin}
                    onChange={(e) => setLGstin(e.target.value.toUpperCase())}
                    placeholder="24AAACP4120H1ZN"
                  />
                </div>
                <div className="field" style={{ justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-cobalt">
                    Create Ledger
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="ws-card">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ledger Name</th>
                    <th>Parent Group</th>
                    <th>GSTIN</th>
                    <th>State</th>
                    <th className="num">Opening Bal</th>
                    <th>Tally Sync</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgers.map((l) => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 700 }}>{l.name}</td>
                      <td>{l.parent_group}</td>
                      <td className="mono">{l.gstin || '—'}</td>
                      <td>{l.state_name}</td>
                      <td className="num">₹{l.opening_balance.toLocaleString('en-IN')}</td>
                      <td>
                        <span className={`badge ${l.tally_synced ? 'badge-ok' : 'badge-warn'}`}>
                          {l.tally_synced ? 'Synced' : 'Pending XML'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="ws-card">
            <div className="ws-card-body">
              <form onSubmit={(e) => void handleAddItem(e)} className="form-grid">
                <div className="field">
                  <label>Stock Item Name</label>
                  <input
                    className="input"
                    value={iName}
                    onChange={(e) => setIName(e.target.value)}
                    required
                    placeholder="CNC Spindle Bearing 45mm"
                  />
                </div>
                <div className="field">
                  <label>UQC Base Unit</label>
                  <select className="select" value={iUnit} onChange={(e) => setIUnit(e.target.value)}>
                    {['NOS', 'KG', 'MTR', 'BOX', 'PCS'].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>6-Digit HSN</label>
                  <input
                    className="input mono"
                    value={iHsn}
                    onChange={(e) => setIHsn(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label>GST Rate (%)</label>
                  <select
                    className="select"
                    value={iRate}
                    onChange={(e) => setIRate(Number(e.target.value))}
                  >
                    {[5, 12, 18, 28].map((r) => (
                      <option key={r} value={r}>
                        {r}%
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-cobalt">
                    Create Stock Item
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="ws-card">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Stock Item</th>
                    <th>Unit</th>
                    <th>HSN</th>
                    <th className="num">GST %</th>
                    <th className="num">Opening Qty</th>
                    <th className="num">Opening Value</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td style={{ fontWeight: 700 }}>{it.name}</td>
                      <td className="mono">{it.base_unit}</td>
                      <td className="mono">{it.hsn_code}</td>
                      <td className="num">{it.gst_rate}%</td>
                      <td className="num">{it.opening_qty}</td>
                      <td className="num">₹{it.opening_value.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </WorkspaceLayout>
  );
}

export function VyaparSyncPage() {
  const { activeCompany, activeCompanyId, showToast } = useWorkspace();
  const [lastSyncedVoucher, setLastSyncedVoucher] = useState<string | null>(null);

  const handleTriggerVyaparSync = async () => {
    const res = await fetch('/api/vyapar/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: activeCompanyId }),
    });
    if (res.ok) {
      const d = (await res.json()) as { voucherNo: string };
      setLastSyncedVoucher(d.voucherNo);
      showToast(`Pulled Vyapar invoice ${d.voucherNo} into Tally pre-accounting queue!`);
    }
  };

  return (
    <WorkspaceLayout>
      <div className="ws-page-header">
        <div>
          <h1 className="ws-page-title">1-Click Vyapar Billing App → TallyPrime Bridge</h1>
          <p className="ws-page-sub">
            Clients billing on Vyapar Mobile/Desktop sync directly into your CA firm’s TallyPrime ledger mapping queue.
          </p>
        </div>
      </div>

      <div className="ws-card">
        <div className="ws-card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ margin: '0 0 6px' }}>
              Connected Vyapar Business Profile: {activeCompany?.trade_name}
            </h3>
            <p style={{ margin: 0, color: '#475569', fontSize: '13.5px' }}>
              Automatically maps Vyapar Party Names, GSTINs, Item HSNs, and Cash/UPI receipts to{' '}
              <strong>{activeCompany?.tally_company_name}</strong>.
            </p>
            {lastSyncedVoucher ? (
              <div style={{ marginTop: '10px' }}>
                <span className="badge badge-ok">
                  Latest Synced Vyapar Invoice: {lastSyncedVoucher}
                </span>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="btn btn-crimson btn-lg"
            onClick={() => void handleTriggerVyaparSync()}
          >
            <RefreshCw size={16} /> Pull Latest Vyapar Invoices Now
          </button>
        </div>
      </div>
    </WorkspaceLayout>
  );
}
