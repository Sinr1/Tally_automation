import {
  CheckCircle2,
  Code2,
  ShieldAlert,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { WorkspaceLayout } from '../components/WorkspaceLayout.tsx';
import { useWorkspace } from '../context/WorkspaceContext.tsx';

interface ValidationIssue {
  voucherId: number;
  voucherNo: string;
  voucherType: string;
  partyName: string;
  detail: string;
  suggestedFix: string;
  fixType: string;
}

interface ValidationRule {
  ruleId: string;
  ruleNumber: number;
  category: string;
  ruleName: string;
  description: string;
  severity: 'Critical' | 'Warning';
  status: 'Passed' | 'Action Required';
  issueCount: number;
  issues: ValidationIssue[];
}

interface RecoReport {
  returnType: string;
  totals: {
    totalRecords: number;
    exactMatches: number;
    actionRequired: number;
    booksTotalTax: number;
    portalTotalTax: number;
    eligibleImsItc: number;
  };
  summaryView: {
    status: string;
    count: number;
    booksTaxable: number;
    portalTaxable: number;
    booksTax: number;
    portalTax: number;
    difference: number;
  }[];
  monthView: {
    month: string;
    count: number;
    booksTax: number;
    portalTax: number;
    matched: number;
    issues: number;
  }[];
  voucherView: {
    key: string;
    status: string;
    counterpartyGstin: string;
    counterpartyName: string;
    booksInvoiceNo: string | null;
    portalInvoiceNo: string | null;
    invoiceDate: string;
    booksTaxable: number;
    portalTaxable: number;
    booksTax: number;
    portalTax: number;
    taxDifference: number;
    filingStatus: string;
    imsStatus: 'Pending' | 'Accepted' | 'Rejected' | 'N/A';
    portalId: number | null;
  }[];
  vendorView: {
    gstin: string;
    name: string;
    totalInvoices: number;
    matchedCount: number;
    mismatchCount: number;
    booksTax: number;
    portalTax: number;
    atRiskItc: number;
    complianceScore: number;
  }[];
}

export function GstDashboardPage() {
  const { activeCompany, activeCompanyId } = useWorkspace();
  const [valSummary, setValSummary] = useState<{
    totalRules: number;
    passedRules: number;
    totalIssues: number;
  } | null>(null);
  const [reco, setReco] = useState<RecoReport | null>(null);

  useEffect(() => {
    void (async () => {
      const [vRes, rRes] = await Promise.all([
        fetch(`/api/gst/validations?companyId=${activeCompanyId}`),
        fetch(`/api/gst/reconcile?companyId=${activeCompanyId}&returnType=GSTR-2B`),
      ]);
      if (vRes.ok) setValSummary(await vRes.json());
      if (rRes.ok) setReco(await rRes.json());
    })();
  }, [activeCompanyId]);

  return (
    <WorkspaceLayout>
      <div className="ws-page-header">
        <div>
          <h1 className="ws-page-title">GST Compliance &amp; IMS Command Hub</h1>
          <p className="ws-page-sub">
            GSTIN: <span className="mono">{activeCompany?.gstin}</span> · Opening Electronic Credit
            Ledger: IGST ₹{(activeCompany?.credit_ledger_igst ?? 0).toLocaleString('en-IN')} | CGST ₹
            {(activeCompany?.credit_ledger_cgst ?? 0).toLocaleString('en-IN')} | SGST ₹
            {(activeCompany?.credit_ledger_sgst ?? 0).toLocaleString('en-IN')}
          </p>
        </div>

        <div className="ws-header-actions">
          <Link to="/app/ga/audit/reviewAndFix" className="btn btn-secondary">
            32 Smart Validations ({valSummary?.totalIssues ?? 0} Issues)
          </Link>
          <Link to="/app/ga/gstr3b-filing" className="btn btn-cobalt">
            Open GSTR-3B Offset Workbench
          </Link>
        </div>
      </div>

      <div className="kpi-strip">
        <div className="kpi-cell">
          <div className="kpi-label">32-Rule Audit Score</div>
          <div className="kpi-value">
            {valSummary?.passedRules ?? 0}/{valSummary?.totalRules ?? 32} Passed
          </div>
          <div className="kpi-sub">{valSummary?.totalIssues ?? 0} voucher issue(s) detected</div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-label">Books Input Tax</div>
          <div className="kpi-value">
            ₹{(reco?.totals.booksTotalTax ?? 0).toLocaleString('en-IN')}
          </div>
          <div className="kpi-sub">Purchase + Debit Note register</div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-label">Portal GSTR-2B Tax</div>
          <div className="kpi-value">
            ₹{(reco?.totals.portalTotalTax ?? 0).toLocaleString('en-IN')}
          </div>
          <div className="kpi-sub">{reco?.totals.exactMatches ?? 0} exact invoice matches</div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-label">IMS Eligible ITC (4A5)</div>
          <div className="kpi-value" style={{ color: '#15803d' }}>
            ₹{(reco?.totals.eligibleImsItc ?? 0).toLocaleString('en-IN')}
          </div>
          <div className="kpi-sub">Excludes IMS Rejected invoices</div>
        </div>
      </div>

      <div className="feature-split-grid">
        <div className="clean-panel">
          <h3>1. Pre-Filing 32 Smart GST Validations</h3>
          <p>
            Automatically verify Modulo-36 GSTIN check digits, Intra/Inter POS tax heads, 6-digit
            HSN codes, Rule 46 invoice length, RCM u/s 9(3), and Sec 17(5) blocked credits.
          </p>
          <Link to="/app/ga/audit/reviewAndFix" className="btn btn-cobalt btn-sm">
            Review &amp; 1-Click Fix Issues →
          </Link>
        </div>

        <div className="clean-panel">
          <h3>2. GSTR-2B &amp; IMS Multi-View Reconciliation</h3>
          <p>
            Compare Tally books vs GSTN portal across Summary, Month, Voucher, and Vendor Compliance
            views with live IMS Accept / Pending / Reject controls.
          </p>
          <Link to="/app/ga/audit/ims" className="btn btn-cobalt btn-sm">
            Open IMS Reconciler →
          </Link>
        </div>

        <div className="clean-panel">
          <h3>3. GSTR-1 JSON &amp; GSTR-3B Rule 88A Offset</h3>
          <p>
            Download GSTN-ready GSTR-1 JSON (Tables 4A, 5A, 7, 8, 9B, 12) and compute Section 49A
            IGST → CGST → SGST cross-utilization for PMT-06 cash challan.
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link to="/app/ga/return-filing" className="btn btn-secondary btn-sm">
              GSTR-1 JSON
            </Link>
            <Link to="/app/ga/gstr3b-filing" className="btn btn-cobalt btn-sm">
              GSTR-3B Offset
            </Link>
          </div>
        </div>
      </div>
    </WorkspaceLayout>
  );
}

export function SmartGstValidationsPage() {
  const { activeCompanyId, showToast } = useWorkspace();
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'FAILED' | 'PASSED'>('ALL');
  const [counts, setCounts] = useState({ total: 32, passed: 0, issues: 0 });

  const loadValidations = useCallback(async () => {
    const res = await fetch(`/api/gst/validations?companyId=${activeCompanyId}`);
    if (res.ok) {
      const d = (await res.json()) as {
        totalRules: number;
        passedRules: number;
        totalIssues: number;
        rules: ValidationRule[];
      };
      setRules(d.rules);
      setCounts({ total: d.totalRules, passed: d.passedRules, issues: d.totalIssues });
    }
  }, [activeCompanyId]);

  useEffect(() => {
    void loadValidations();
  }, [loadValidations]);

  const handleAutoFix = async (voucherId: number, fixType: string) => {
    const res = await fetch('/api/gst/validations/fix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: activeCompanyId, voucherId, fixType }),
    });
    if (res.ok) {
      const d = (await res.json()) as { fixed: boolean; message: string };
      showToast(d.message);
      void loadValidations();
    }
  };

  const visibleRules = rules.filter((r) => {
    if (filter === 'FAILED') return r.issueCount > 0;
    if (filter === 'PASSED') return r.issueCount === 0;
    return true;
  });

  return (
    <WorkspaceLayout>
      <div className="ws-page-header">
        <div>
          <h1 className="ws-page-title">32 Smart GST Validations — Review &amp; 1-Click Fix</h1>
          <p className="ws-page-sub">
            Automated statutory audit across GSTIN Checksum, Place of Supply, HSN/SAC, Rule 46, RCM, and Credit Ledger.
          </p>
        </div>

        <div className="ws-header-actions">
          <div className="sub-tabs">
            <button
              type="button"
              className={`sub-tab ${filter === 'ALL' ? 'active' : ''}`}
              onClick={() => setFilter('ALL')}
            >
              All 32 Rules
            </button>
            <button
              type="button"
              className={`sub-tab ${filter === 'FAILED' ? 'active' : ''}`}
              onClick={() => setFilter('FAILED')}
            >
              Action Required ({counts.total - counts.passed})
            </button>
            <button
              type="button"
              className={`sub-tab ${filter === 'PASSED' ? 'active' : ''}`}
              onClick={() => setFilter('PASSED')}
            >
              Passed ({counts.passed})
            </button>
          </div>
        </div>
      </div>

      <div className="ws-card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Category</th>
                <th>Validation Check &amp; Findings</th>
                <th>Severity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRules.map((r) => (
                <tr key={r.ruleId}>
                  <td className="mono" style={{ fontWeight: 700 }}>
                    {r.ruleId}
                  </td>
                  <td>
                    <span className="badge badge-neutral">{r.category}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{r.ruleName}</div>
                    <div style={{ fontSize: '12px', color: '#475569' }}>{r.description}</div>

                    {r.issues.length > 0 && (
                      <div
                        style={{
                          marginTop: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        {r.issues.map((iss, idx) => (
                          <div
                            key={`${iss.voucherId}-${idx}`}
                            style={{
                              background: '#fff1f2',
                              border: '1px solid #fecdd3',
                              borderRadius: '6px',
                              padding: '8px 10px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '10px',
                              flexWrap: 'wrap',
                            }}
                          >
                            <div>
                              <span className="mono" style={{ fontWeight: 700 }}>
                                {iss.voucherNo}
                              </span>{' '}
                              ({iss.partyName}) — {iss.detail}
                            </div>
                            {iss.fixType !== 'MANUAL_REVIEW' ? (
                              <button
                                type="button"
                                className="btn btn-cobalt btn-sm"
                                onClick={() => void handleAutoFix(iss.voucherId, iss.fixType)}
                              >
                                <Wrench size={12} /> 1-Click Auto-Fix
                              </button>
                            ) : (
                              <span className="badge badge-warn">Review</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        r.severity === 'Critical' ? 'badge-err' : 'badge-warn'
                      }`}
                    >
                      {r.severity}
                    </span>
                  </td>
                  <td>
                    {r.issueCount === 0 ? (
                      <span className="badge badge-ok">
                        <CheckCircle2 size={12} /> Passed
                      </span>
                    ) : (
                      <span className="badge badge-err">
                        <ShieldAlert size={12} /> {r.issueCount} Issue(s)
                      </span>
                    )}
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

export function GstReconcileImsPage({
  defaultReturn = 'GSTR-2B',
}: {
  defaultReturn?: 'GSTR-1' | 'GSTR-2A' | 'GSTR-2B';
}) {
  const { activeCompanyId, showToast } = useWorkspace();
  const [returnType, setReturnType] = useState<'GSTR-1' | 'GSTR-2A' | 'GSTR-2B'>(defaultReturn);
  const [viewMode, setViewMode] = useState<'voucher' | 'summary' | 'month' | 'vendor'>('voucher');
  const [report, setReport] = useState<RecoReport | null>(null);

  useEffect(() => {
    setReturnType(defaultReturn);
  }, [defaultReturn]);

  const loadReco = useCallback(async () => {
    const res = await fetch(
      `/api/gst/reconcile?companyId=${activeCompanyId}&returnType=${returnType}`
    );
    if (res.ok) {
      setReport((await res.json()) as RecoReport);
    }
  }, [activeCompanyId, returnType]);

  useEffect(() => {
    void loadReco();
  }, [loadReco]);

  const handleImsAction = async (
    portalId: number,
    imsStatus: 'Accepted' | 'Pending' | 'Rejected'
  ) => {
    const res = await fetch(`/api/gst/ims/${portalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imsStatus }),
    });
    if (res.ok) {
      showToast(`IMS status updated to ${imsStatus} — Eligible ITC recalculated`);
      void loadReco();
    }
  };

  return (
    <WorkspaceLayout>
      <div className="ws-page-header">
        <div>
          <h1 className="ws-page-title">
            {returnType} Reconciliation &amp; IMS (Invoice Management System)
          </h1>
          <p className="ws-page-sub">
            Compare Tally Books against GSTN Portal across Summary, Month, Voucher, and Supplier Compliance views.
          </p>
        </div>

        <div className="ws-header-actions">
          <div className="sub-tabs">
            {(['GSTR-2B', 'GSTR-2A', 'GSTR-1'] as const).map((rt) => (
              <button
                key={rt}
                type="button"
                className={`sub-tab ${returnType === rt ? 'active' : ''}`}
                onClick={() => setReturnType(rt)}
              >
                {rt}
              </button>
            ))}
          </div>

          <div className="sub-tabs">
            {(
              [
                ['voucher', 'Voucher View & IMS'],
                ['summary', 'Summary View'],
                ['month', 'Month View'],
                ['vendor', 'Vendor Scorecard'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={`sub-tab ${viewMode === k ? 'active' : ''}`}
                onClick={() => setViewMode(k)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="kpi-strip">
        <div className="kpi-cell">
          <div className="kpi-label">Books GST Total</div>
          <div className="kpi-value">
            ₹{(report?.totals.booksTotalTax ?? 0).toLocaleString('en-IN')}
          </div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-label">Portal GST Total</div>
          <div className="kpi-value">
            ₹{(report?.totals.portalTotalTax ?? 0).toLocaleString('en-IN')}
          </div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-label">Variances / Missing</div>
          <div className="kpi-value" style={{ color: '#b45309' }}>
            {report?.totals.actionRequired ?? 0} Records
          </div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-label">IMS Eligible ITC</div>
          <div className="kpi-value" style={{ color: '#15803d' }}>
            ₹{(report?.totals.eligibleImsItc ?? 0).toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {viewMode === 'voucher' && (
        <div className="ws-card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Match Status</th>
                  <th>Counterparty &amp; GSTIN</th>
                  <th>Books Inv #</th>
                  <th>Portal Inv #</th>
                  <th className="num">Books Tax</th>
                  <th className="num">Portal Tax</th>
                  <th className="num">Diff</th>
                  <th>IMS Action</th>
                </tr>
              </thead>
              <tbody>
                {(report?.voucherView || []).map((r) => (
                  <tr key={r.key}>
                    <td>
                      <span
                        className={`badge ${
                          r.status === 'Exact Match'
                            ? 'badge-ok'
                            : r.status === 'Fuzzy Match'
                              ? 'badge-info'
                              : 'badge-warn'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.counterpartyName}</div>
                      <div className="mono" style={{ color: '#64748b' }}>
                        {r.counterpartyGstin}
                      </div>
                    </td>
                    <td className="mono">{r.booksInvoiceNo || '—'}</td>
                    <td className="mono">{r.portalInvoiceNo || '—'}</td>
                    <td className="num">₹{r.booksTax.toLocaleString('en-IN')}</td>
                    <td className="num">₹{r.portalTax.toLocaleString('en-IN')}</td>
                    <td
                      className="num"
                      style={{
                        fontWeight: 700,
                        color: r.taxDifference !== 0 ? '#b91c1c' : '#15803d',
                      }}
                    >
                      {r.taxDifference === 0
                        ? '₹0'
                        : `${r.taxDifference > 0 ? '+' : ''}₹${r.taxDifference.toLocaleString('en-IN')}`}
                    </td>
                    <td>
                      {r.portalId && returnType !== 'GSTR-1' ? (
                        <select
                          className="inline-select"
                          value={r.imsStatus}
                          onChange={(e) =>
                            void handleImsAction(
                              r.portalId!,
                              e.target.value as 'Accepted' | 'Pending' | 'Rejected'
                            )
                          }
                        >
                          <option value="Accepted">IMS: Accepted</option>
                          <option value="Pending">IMS: Pending</option>
                          <option value="Rejected">IMS: Rejected</option>
                        </select>
                      ) : (
                        <span className="mono" style={{ color: '#64748b' }}>
                          {r.filingStatus}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === 'summary' && (
        <div className="ws-card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reconciliation Bucket</th>
                  <th className="num">Invoices</th>
                  <th className="num">Books Taxable</th>
                  <th className="num">Portal Taxable</th>
                  <th className="num">Books GST</th>
                  <th className="num">Portal GST</th>
                  <th className="num">Net Tax Variance</th>
                </tr>
              </thead>
              <tbody>
                {(report?.summaryView || []).map((s) => (
                  <tr key={s.status}>
                    <td style={{ fontWeight: 700 }}>{s.status}</td>
                    <td className="num">{s.count}</td>
                    <td className="num">₹{s.booksTaxable.toLocaleString('en-IN')}</td>
                    <td className="num">₹{s.portalTaxable.toLocaleString('en-IN')}</td>
                    <td className="num">₹{s.booksTax.toLocaleString('en-IN')}</td>
                    <td className="num">₹{s.portalTax.toLocaleString('en-IN')}</td>
                    <td className="num" style={{ fontWeight: 700 }}>
                      ₹{s.difference.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === 'month' && (
        <div className="ws-card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Return Period</th>
                  <th className="num">Total Invoices</th>
                  <th className="num">Exact Matched</th>
                  <th className="num">Exceptions</th>
                  <th className="num">Books Tax</th>
                  <th className="num">Portal Tax</th>
                </tr>
              </thead>
              <tbody>
                {(report?.monthView || []).map((m) => (
                  <tr key={m.month}>
                    <td className="mono" style={{ fontWeight: 700 }}>
                      {m.month}
                    </td>
                    <td className="num">{m.count}</td>
                    <td className="num">{m.matched}</td>
                    <td className="num">{m.issues}</td>
                    <td className="num">₹{m.booksTax.toLocaleString('en-IN')}</td>
                    <td className="num">₹{m.portalTax.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === 'vendor' && (
        <div className="ws-card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Supplier / Counterparty</th>
                  <th>GSTIN</th>
                  <th className="num">Bills</th>
                  <th className="num">Books Tax</th>
                  <th className="num">Portal Tax</th>
                  <th className="num">At-Risk ITC</th>
                  <th>Filing Score</th>
                </tr>
              </thead>
              <tbody>
                {(report?.vendorView || []).map((v) => (
                  <tr key={v.gstin + v.name}>
                    <td style={{ fontWeight: 700 }}>{v.name}</td>
                    <td className="mono">{v.gstin}</td>
                    <td className="num">{v.totalInvoices}</td>
                    <td className="num">₹{v.booksTax.toLocaleString('en-IN')}</td>
                    <td className="num">₹{v.portalTax.toLocaleString('en-IN')}</td>
                    <td className="num" style={{ color: v.atRiskItc > 0 ? '#b91c1c' : '#15803d' }}>
                      ₹{v.atRiskItc.toLocaleString('en-IN')}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          v.complianceScore === 100 ? 'badge-ok' : 'badge-warn'
                        }`}
                      >
                        {v.complianceScore}% Compliant
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </WorkspaceLayout>
  );
}

export function Gstr1FilingPage() {
  const { activeCompany, activeCompanyId, setXmlModal } = useWorkspace();
  const [data, setData] = useState<{
    tablesSummary: {
      table: string;
      count: number;
      taxable: number;
      igst: number;
      cgst: number;
      sgst: number;
    }[];
    gstnPayload: Record<string, unknown>;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/gst/gstr1?companyId=${activeCompanyId}&period=102025`);
      if (res.ok) setData(await res.json());
    })();
  }, [activeCompanyId]);

  return (
    <WorkspaceLayout>
      <div className="ws-page-header">
        <div>
          <h1 className="ws-page-title">GSTR-1 Table Summary &amp; Official GSTN JSON Export</h1>
          <p className="ws-page-sub">
            Period: October 2025 (<span className="mono">102025</span>) · GSTN Schema{' '}
            <span className="mono">GST3.1.6</span>
          </p>
        </div>

        <button
          type="button"
          className="btn btn-cobalt"
          onClick={() => {
            if (!data) return;
            setXmlModal({
              title: `GSTN GSTR-1 Offline JSON — ${activeCompany?.gstin || ''}`,
              filename: `GSTR1_${activeCompany?.gstin || '24'}_102025.json`,
              xml: JSON.stringify(data.gstnPayload, null, 2),
              subtitle: 'Ready for direct upload on services.gst.gov.in',
            });
          }}
        >
          <Code2 size={15} /> Inspect &amp; Download GSTR-1 .JSON
        </button>
      </div>

      <div className="ws-card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>GSTR-1 Return Table</th>
                <th className="num">Record Count</th>
                <th className="num">Taxable Value</th>
                <th className="num">IGST</th>
                <th className="num">CGST</th>
                <th className="num">SGST</th>
              </tr>
            </thead>
            <tbody>
              {(data?.tablesSummary || []).map((t) => (
                <tr key={t.table}>
                  <td style={{ fontWeight: 700 }}>{t.table}</td>
                  <td className="num">{t.count}</td>
                  <td className="num">₹{t.taxable.toLocaleString('en-IN')}</td>
                  <td className="num">₹{t.igst.toLocaleString('en-IN')}</td>
                  <td className="num">₹{t.cgst.toLocaleString('en-IN')}</td>
                  <td className="num">₹{t.sgst.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </WorkspaceLayout>
  );
}

export function Gstr3bFilingPage() {
  const { activeCompanyId } = useWorkspace();
  const [data, setData] = useState<{
    table3_1: {
      outwardTaxable: number;
      outwardIgst: number;
      outwardCgst: number;
      outwardSgst: number;
      rcmTaxable: number;
      rcmIgst: number;
      rcmCgst: number;
      rcmSgst: number;
    };
    table4: {
      openingCreditLedger: { igst: number; cgst: number; sgst: number };
      currentEligibleItc: { igst: number; cgst: number; sgst: number };
      imsRejectedItc: { count: number; amount: number };
    };
    table6_1_offset: {
      igstToIgst: number;
      igstToCgst: number;
      igstToSgst: number;
      cgstToCgst: number;
      cgstToIgst: number;
      sgstToSgst: number;
      sgstToIgst: number;
      closingCreditLedger: { igst: number; cgst: number; sgst: number };
      netCashChallanPmt06: { igst: number; cgst: number; sgst: number; total: number };
    };
  } | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/gst/gstr3b?companyId=${activeCompanyId}`);
      if (res.ok) setData(await res.json());
    })();
  }, [activeCompanyId]);

  const off = data?.table6_1_offset;

  return (
    <WorkspaceLayout>
      <div className="ws-page-header">
        <div>
          <h1 className="ws-page-title">
            GSTR-3B Summary &amp; Section 49A / Rule 88A ITC Offset Calculator
          </h1>
          <p className="ws-page-sub">
            Exhausts IGST Credit first (IGST → CGST → SGST) before touching CGST/SGST pools, and isolates mandatory cash RCM u/s 49(4).
          </p>
        </div>
        <Link to="/app/ga/audit/ims" className="btn btn-secondary">
          <Sparkles size={14} /> Adjust IMS Invoices
        </Link>
      </div>

      <div className="kpi-strip">
        <div className="kpi-cell">
          <div className="kpi-label">Table 3.1(a) Outward Tax</div>
          <div className="kpi-value">
            ₹
            {(
              (data?.table3_1.outwardIgst ?? 0) +
              (data?.table3_1.outwardCgst ?? 0) +
              (data?.table3_1.outwardSgst ?? 0)
            ).toLocaleString('en-IN')}
          </div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-label">Table 3.1(d) RCM (Cash Only)</div>
          <div className="kpi-value">
            ₹
            {(
              (data?.table3_1.rcmIgst ?? 0) +
              (data?.table3_1.rcmCgst ?? 0) +
              (data?.table3_1.rcmSgst ?? 0)
            ).toLocaleString('en-IN')}
          </div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-label">IMS Rejected Excluded</div>
          <div className="kpi-value" style={{ color: '#b91c1c' }}>
            ₹{(data?.table4.imsRejectedItc.amount ?? 0).toLocaleString('en-IN')}
          </div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-label">Net PMT-06 Cash Challan</div>
          <div className="kpi-value" style={{ color: '#1a48d3' }}>
            ₹{(off?.netCashChallanPmt06.total ?? 0).toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      <div className="ws-card">
        <div className="ws-card-head">
          <h3>Table 6.1 — Statutory ITC Cross-Utilization &amp; Cash Payable Matrix</h3>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tax Head</th>
                <th className="num">Output Liability</th>
                <th className="num">Opening + 2B ITC</th>
                <th className="num">Paid via IGST Credit</th>
                <th className="num">Paid via CGST/SGST</th>
                <th className="num">RCM Cash</th>
                <th className="num">Net PMT-06 Cash</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 700 }}>Integrated Tax (IGST)</td>
                <td className="num">₹{(data?.table3_1.outwardIgst ?? 0).toLocaleString('en-IN')}</td>
                <td className="num">
                  ₹
                  {(
                    (data?.table4.openingCreditLedger.igst ?? 0) +
                    (data?.table4.currentEligibleItc.igst ?? 0)
                  ).toLocaleString('en-IN')}
                </td>
                <td className="num">₹{(off?.igstToIgst ?? 0).toLocaleString('en-IN')}</td>
                <td className="num">
                  ₹{((off?.cgstToIgst ?? 0) + (off?.sgstToIgst ?? 0)).toLocaleString('en-IN')}
                </td>
                <td className="num">₹{(data?.table3_1.rcmIgst ?? 0).toLocaleString('en-IN')}</td>
                <td className="num" style={{ fontWeight: 700 }}>
                  ₹{(off?.netCashChallanPmt06.igst ?? 0).toLocaleString('en-IN')}
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 700 }}>Central Tax (CGST)</td>
                <td className="num">₹{(data?.table3_1.outwardCgst ?? 0).toLocaleString('en-IN')}</td>
                <td className="num">
                  ₹
                  {(
                    (data?.table4.openingCreditLedger.cgst ?? 0) +
                    (data?.table4.currentEligibleItc.cgst ?? 0)
                  ).toLocaleString('en-IN')}
                </td>
                <td className="num">₹{(off?.igstToCgst ?? 0).toLocaleString('en-IN')}</td>
                <td className="num">₹{(off?.cgstToCgst ?? 0).toLocaleString('en-IN')}</td>
                <td className="num">₹{(data?.table3_1.rcmCgst ?? 0).toLocaleString('en-IN')}</td>
                <td className="num" style={{ fontWeight: 700 }}>
                  ₹{(off?.netCashChallanPmt06.cgst ?? 0).toLocaleString('en-IN')}
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 700 }}>State / UT Tax (SGST)</td>
                <td className="num">₹{(data?.table3_1.outwardSgst ?? 0).toLocaleString('en-IN')}</td>
                <td className="num">
                  ₹
                  {(
                    (data?.table4.openingCreditLedger.sgst ?? 0) +
                    (data?.table4.currentEligibleItc.sgst ?? 0)
                  ).toLocaleString('en-IN')}
                </td>
                <td className="num">₹{(off?.igstToSgst ?? 0).toLocaleString('en-IN')}</td>
                <td className="num">₹{(off?.sgstToSgst ?? 0).toLocaleString('en-IN')}</td>
                <td className="num">₹{(data?.table3_1.rcmSgst ?? 0).toLocaleString('en-IN')}</td>
                <td className="num" style={{ fontWeight: 700 }}>
                  ₹{(off?.netCashChallanPmt06.sgst ?? 0).toLocaleString('en-IN')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </WorkspaceLayout>
  );
}

export function GstNoticesPage() {
  const { activeCompanyId, showToast } = useWorkspace();
  const [notices, setNotices] = useState<
    {
      id: number;
      notice_type: string;
      arn_din: string;
      section_ref: string;
      issue_date: string;
      due_date: string;
      demand_amount: number;
      description: string;
      assigned_to: string;
      status: string;
    }[]
  >([]);
  const [noticeType, setNoticeType] = useState('FORM GST ASMT-10');
  const [demand, setDemand] = useState(25000);
  const [desc, setDesc] = useState('');

  const loadNotices = useCallback(async () => {
    const res = await fetch(`/api/gst/notices?companyId=${activeCompanyId}`);
    if (res.ok) {
      const d = (await res.json()) as { notices: typeof notices };
      setNotices(d.notices);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    void loadNotices();
  }, [loadNotices]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/gst/notices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: activeCompanyId,
        notice_type: noticeType,
        demand_amount: demand,
        description: desc,
      }),
    });
    if (res.ok) {
      setDesc('');
      showToast('Logged GST Notice into compliance tracker');
      void loadNotices();
    }
  };

  return (
    <WorkspaceLayout>
      <div className="ws-page-header">
        <div>
          <h1 className="ws-page-title">GST Portal Notices &amp; Scrutiny Tracker</h1>
          <p className="ws-page-sub">Track ASMT-10, DRC-01, GSTR-3A, and REG-17 reply deadlines across staff.</p>
        </div>
      </div>

      <div className="ws-card">
        <div className="ws-card-body">
          <form onSubmit={(e) => void handleAdd(e)} className="form-grid">
            <div className="field">
              <label>Form / Notice Type</label>
              <select
                className="select"
                value={noticeType}
                onChange={(e) => setNoticeType(e.target.value)}
              >
                <option value="FORM GST ASMT-10">FORM GST ASMT-10 (Sec 61 Scrutiny)</option>
                <option value="FORM GST DRC-01">FORM GST DRC-01 (Sec 73/74 SCN)</option>
                <option value="FORM GST GSTR-3A">FORM GST GSTR-3A (Non-Filer)</option>
              </select>
            </div>
            <div className="field">
              <label>Disputed Tax / Demand (₹)</label>
              <input
                type="number"
                className="input"
                value={demand}
                onChange={(e) => setDemand(Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Summary of Scrutiny Query</label>
              <input
                className="input"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                required
                placeholder="ITC variance between GSTR-3B and GSTR-2B"
              />
            </div>
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-cobalt">
                Log Notice
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
                <th>Form &amp; ARN/DIN</th>
                <th>Section</th>
                <th>Issue Summary</th>
                <th className="num">Demand</th>
                <th>Reply Due</th>
                <th>Assignee</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {notices.map((n) => (
                <tr key={n.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{n.notice_type}</div>
                    <div className="mono" style={{ color: '#64748b' }}>
                      {n.arn_din}
                    </div>
                  </td>
                  <td>{n.section_ref}</td>
                  <td>{n.description}</td>
                  <td className="num">₹{n.demand_amount.toLocaleString('en-IN')}</td>
                  <td className="mono">{n.due_date}</td>
                  <td>{n.assigned_to}</td>
                  <td>
                    <span className="badge badge-warn">{n.status}</span>
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
