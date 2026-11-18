import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Plus,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { WorkspaceLayout } from '../components/WorkspaceLayout.tsx';
import { useWorkspace } from '../context/WorkspaceContext.tsx';

interface DashboardResponse {
  firmSummary: {
    subscribedCompanies: number;
    totalVouchersAutomated: number;
    hoursSavedMonthly: number;
    gstPortalConnectedCount: number;
  };
  companyMetrics: {
    salesTurnover: number;
    purchaseSpend: number;
    totalVouchers: number;
    pushedToTally: number;
    pendingTallySync: number;
    bankTotalRows: number;
    bankUnmappedRows: number;
    bankDuplicateRows: number;
    gstFailedRules: number;
    gstTotalIssues: number;
    eligibleImsItc: number;
    netCashChallan: number;
    openTasks: number;
  };
  recentActivity: {
    id: number;
    actor: string;
    module: string;
    action: string;
    created_at: string;
  }[];
}

export function PracticeDashboardPage() {
  const { activeCompany, activeCompanyId, showToast, setXmlModal } = useWorkspace();
  const [data, setData] = useState<DashboardResponse | null>(null);

  const loadDashboard = useCallback(async () => {
    const res = await fetch(`/api/dashboard?companyId=${activeCompanyId}`);
    if (res.ok) {
      setData((await res.json()) as DashboardResponse);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleSyncAllVouchers = async () => {
    const res = await fetch('/api/tally/sync/vouchers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: activeCompanyId }),
    });
    if (!res.ok) return;
    const result = (await res.json()) as {
      syncedCount: number;
      filename: string;
      xml: string;
      bridge: { statusMessage: string };
    };
    showToast(result.bridge.statusMessage);
    setXmlModal({
      title: `TallyPrime Vouchers <ENVELOPE> (${result.syncedCount} Vouchers)`,
      filename: result.filename,
      xml: result.xml,
      subtitle: result.bridge.statusMessage,
    });
    void loadDashboard();
  };

  const m = data?.companyMetrics;

  return (
    <WorkspaceLayout>
      <div className="ws-page-header">
        <div>
          <h1 className="ws-page-title">
            Practice Command Center — {activeCompany?.name || 'Loading...'}
          </h1>
          <p className="ws-page-sub">
            GSTIN: <span className="mono">{activeCompany?.gstin}</span> · Tally Target:{' '}
            <strong>{activeCompany?.tally_company_name}</strong> · Books:{' '}
            {activeCompany?.books_source}
          </p>
        </div>
        <div className="ws-header-actions">
          <Link to="/app/ga/audit/reviewAndFix" className="btn btn-secondary">
            32-Rule GST Audit ({m?.gstTotalIssues ?? 0} Issues)
          </Link>
          <button
            type="button"
            className="btn btn-cobalt"
            onClick={() => void handleSyncAllVouchers()}
          >
            <RefreshCw size={14} /> Sync Books to TallyPrime
          </button>
        </div>
      </div>

      <div className="kpi-strip">
        <div className="kpi-cell">
          <div className="kpi-label">Outward Sales Turnover</div>
          <div className="kpi-value">
            ₹{(m?.salesTurnover ?? 0).toLocaleString('en-IN')}
          </div>
          <div className="kpi-sub">
            {m?.pushedToTally ?? 0}/{m?.totalVouchers ?? 0} vouchers pushed to Tally
          </div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-label">Inward Purchase Spend</div>
          <div className="kpi-value">
            ₹{(m?.purchaseSpend ?? 0).toLocaleString('en-IN')}
          </div>
          <div className="kpi-sub">
            IMS Eligible ITC: ₹{(m?.eligibleImsItc ?? 0).toLocaleString('en-IN')}
          </div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-label">Banking Pre-Accounting</div>
          <div className="kpi-value">{m?.bankTotalRows ?? 0} Rows</div>
          <div className="kpi-sub">
            {m?.bankUnmappedRows ?? 0} unmapped · {m?.bankDuplicateRows ?? 0} duplicate guard
          </div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-label">32 Smart GST Rules</div>
          <div className="kpi-value" style={{ color: (m?.gstTotalIssues ?? 0) > 0 ? '#b91c1c' : '#15803d' }}>
            {m?.gstTotalIssues ?? 0} Issues
          </div>
          <div className="kpi-sub">
            Net GSTR-3B Cash: ₹{(m?.netCashChallan ?? 0).toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      <div className="split-two">
        <div className="ws-card">
          <div className="ws-card-head">
            <h3>Actionable CA Workflows</h3>
            <span className="badge badge-info">
              {data?.firmSummary.subscribedCompanies ?? 3} Subscribed Companies
            </span>
          </div>
          <div className="ws-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Link
              to="/app/da/banking"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>Banking Statement &amp; Duplicate Guard</div>
                <div style={{ fontSize: '12.5px', color: '#475569' }}>
                  {m?.bankUnmappedRows ?? 0} unmapped statement entries &amp; {m?.bankDuplicateRows ?? 0}{' '}
                  duplicate alert ready for review
                </div>
              </div>
              <ArrowRight size={16} color="#1a48d3" />
            </Link>

            <Link
              to="/app/ga/audit/reviewAndFix"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>Review &amp; Auto-Fix 32 GST Validations</div>
                <div style={{ fontSize: '12.5px', color: '#475569' }}>
                  1-click repair for Modulo-36 GSTIN checksum, POS IGST/CGST mismatch &amp; missing HSN
                </div>
              </div>
              <ArrowRight size={16} color="#1a48d3" />
            </Link>

            <Link
              to="/app/ga/audit/ims"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>GSTR-2B &amp; IMS Reconciliation</div>
                <div style={{ fontSize: '12.5px', color: '#475569' }}>
                  Accept / Reject portal invoices and auto-update GSTR-3B Table 4 Eligible ITC
                </div>
              </div>
              <ArrowRight size={16} color="#1a48d3" />
            </Link>

            <Link
              to="/app/chat"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>Vyapar TaxOne WhatsApp Client Inbox</div>
                <div style={{ fontSize: '12.5px', color: '#475569' }}>
                  Forward client-shared PDFs &amp; spreadsheets straight to Banking, OCR, or Drive
                </div>
              </div>
              <ArrowRight size={16} color="#1a48d3" />
            </Link>
          </div>
        </div>

        <div className="ws-card">
          <div className="ws-card-head">
            <h3>Live Firm Audit Trail</h3>
            <Link to="/app/activity-log" className="btn btn-secondary btn-sm">
              View All
            </Link>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Staff / Engine</th>
                  <th>Module</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recentActivity || []).slice(0, 7).map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.actor}</td>
                    <td>
                      <span className="badge badge-neutral">{item.module}</span>
                    </td>
                    <td>{item.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </WorkspaceLayout>
  );
}

export function SubscribedCompaniesPage() {
  const { companies, activeCompanyId, setActiveCompanyId, refreshCompanies, showToast } =
    useWorkspace();
  const [name, setName] = useState('');
  const [gstin, setGstin] = useState('24AABCT9912K1ZS');
  const [booksSource, setBooksSource] = useState('TallyPrime');

  const handleAddCompany = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        trade_name: name,
        gstin,
        tally_company_name: `${name} FY 25-26`,
        books_source: booksSource,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        company: { id: number; name: string };
        gstinValidation: { valid: boolean; reason?: string };
      };
      await refreshCompanies();
      setActiveCompanyId(data.company.id);
      setName('');
      showToast(
        data.gstinValidation.valid
          ? `Subscribed ${data.company.name} (Valid Modulo-36 GSTIN)`
          : `Added ${data.company.name} (Note: ${data.gstinValidation.reason})`
      );
    }
  };

  return (
    <WorkspaceLayout>
      <div className="ws-page-header">
        <div>
          <h1 className="ws-page-title">Subscribed Tally &amp; Vyapar Client Companies</h1>
          <p className="ws-page-sub">
            Manage TallyPrime HTTP Connector ports, GSTN Portal OTP sessions, and active company context.
          </p>
        </div>
      </div>

      <div className="ws-card">
        <div className="ws-card-head">
          <h3>Subscribe New Client Company</h3>
        </div>
        <div className="ws-card-body">
          <form onSubmit={(e) => void handleAddCompany(e)} className="form-grid">
            <div className="field">
              <label>Legal / Tally Company Name</label>
              <input
                className="input"
                placeholder="e.g. Swastik Precision Gears Pvt Ltd"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>15-Digit GSTIN</label>
              <input
                className="input mono"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                maxLength={15}
                required
              />
            </div>
            <div className="field">
              <label>Accounting Source</label>
              <select
                className="select"
                value={booksSource}
                onChange={(e) => setBooksSource(e.target.value)}
              >
                <option value="TallyPrime">TallyPrime Desktop Connector</option>
                <option value="Vyapar App">Vyapar Billing App</option>
                <option value="Tally + Vyapar">TallyPrime + Vyapar Sync</option>
              </select>
            </div>
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-cobalt">
                <Plus size={15} /> Subscribe Company
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="ws-card">
        <div className="ws-card-head">
          <h3>Subscribed Companies ({companies.length})</h3>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company &amp; Tally Book</th>
                <th>GSTIN &amp; State</th>
                <th>Source</th>
                <th>Tally Port</th>
                <th>GST Portal</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>
                      <Building2 size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                      {c.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569' }}>
                      Tally: {c.tally_company_name}
                    </div>
                  </td>
                  <td>
                    <div className="mono">{c.gstin}</div>
                    <div style={{ fontSize: '11.5px', color: '#475569' }}>
                      {c.state_code}-{c.state_name}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-info">{c.books_source}</span>
                  </td>
                  <td className="mono">127.0.0.1:{c.tally_connector_port}</td>
                  <td>
                    {c.gst_portal_connected ? (
                      <span className="badge badge-ok">
                        <CheckCircle2 size={12} /> OTP Active
                      </span>
                    ) : (
                      <span className="badge badge-warn">
                        <ShieldAlert size={12} /> Reconnect
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`btn btn-sm ${
                        c.id === activeCompanyId ? 'btn-success' : 'btn-secondary'
                      }`}
                      onClick={() => {
                        setActiveCompanyId(c.id);
                        showToast(`Selected ${c.name}`);
                      }}
                    >
                      {c.id === activeCompanyId ? 'Active Workspace' : 'Switch Here'}
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

export function ClientsDirectoryPage() {
  const { companies, showToast } = useWorkspace();
  const [clients, setClients] = useState<
    {
      id: number;
      company_name: string;
      company_gstin: string;
      contact_person: string;
      whatsapp_phone: string;
      email: string;
      filing_frequency: string;
      group_tag: string;
    }[]
  >([]);
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('+91 98250 ');
  const [email, setEmail] = useState('');
  const [companyId, setCompanyId] = useState(1);

  const loadClients = useCallback(async () => {
    const res = await fetch('/api/clients');
    if (res.ok) {
      const data = (await res.json()) as { clients: typeof clients };
      setClients(data.clients);
    }
  }, []);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: companyId,
        contact_person: contactPerson,
        whatsapp_phone: phone,
        email,
        filing_frequency: 'Monthly',
        group_tag: 'Manufacturing B2B',
      }),
    });
    if (res.ok) {
      setContactPerson('');
      setEmail('');
      showToast('Client contact added & enabled for WhatsApp reminders');
      void loadClients();
    }
  };

  return (
    <WorkspaceLayout>
      <div className="ws-page-header">
        <div>
          <h1 className="ws-page-title">Client Contacts &amp; Portal Access</h1>
          <p className="ws-page-sub">
            Map client promoters &amp; accountants to WhatsApp numbers for automated TaxOne Chat collection.
          </p>
        </div>
      </div>

      <div className="ws-card">
        <div className="ws-card-head">
          <h3>Add Client Contact</h3>
        </div>
        <div className="ws-card-body">
          <form onSubmit={(e) => void handleCreate(e)} className="form-grid">
            <div className="field">
              <label>Company</label>
              <select
                className="select"
                value={companyId}
                onChange={(e) => setCompanyId(Number(e.target.value))}
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Contact Person</label>
              <input
                className="input"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                required
                placeholder="Promoter / CFO Name"
              />
            </div>
            <div className="field">
              <label>WhatsApp Number</label>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="accounts@client.in"
              />
            </div>
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-cobalt">
                Save Client
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
                <th>Contact Person</th>
                <th>Subscribed Company</th>
                <th>WhatsApp</th>
                <th>Email</th>
                <th>Regime</th>
                <th>Group</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((cl) => (
                <tr key={cl.id}>
                  <td style={{ fontWeight: 700 }}>{cl.contact_person}</td>
                  <td>
                    {cl.company_name}
                    <div className="mono" style={{ color: '#475569' }}>
                      {cl.company_gstin}
                    </div>
                  </td>
                  <td className="mono">{cl.whatsapp_phone}</td>
                  <td>{cl.email}</td>
                  <td>
                    <span className="badge badge-info">{cl.filing_frequency}</span>
                  </td>
                  <td>
                    <span className="badge badge-neutral">{cl.group_tag}</span>
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

export function UsersRbacPage() {
  const { showToast } = useWorkspace();
  const [users, setUsers] = useState<
    {
      id: number;
      full_name: string;
      email: string;
      phone: string;
      role: string;
      permissions_json: string;
      vouchers_processed: number;
      status: string;
    }[]
  >([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('GST Executive');

  const loadUsers = useCallback(async () => {
    const res = await fetch('/api/auth/users');
    if (res.ok) {
      const data = (await res.json()) as { users: typeof users };
      setUsers(data.users);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName,
        email,
        role,
        permissions:
          role === 'Admin'
            ? ['ALL']
            : role === 'GST Executive'
              ? ['GST_AUDIT', 'IMS', 'GSTR1', 'GSTR3B']
              : ['BANKING', 'OCR_SCAN', 'TALLY_SYNC'],
      }),
    });
    if (res.ok) {
      setFullName('');
      setEmail('');
      showToast(`Invited ${fullName} as ${role}`);
      void loadUsers();
    }
  };

  return (
    <WorkspaceLayout>
      <div className="ws-page-header">
        <div>
          <h1 className="ws-page-title">Firm Staff, RBAC Permissions &amp; Productivity</h1>
          <p className="ws-page-sub">
            Unlimited team logins included — control access across Banking, Tally Sync, and GST Filing.
          </p>
        </div>
      </div>

      <div className="ws-card">
        <div className="ws-card-head">
          <h3>Invite CA Staff / Article Assistant</h3>
        </div>
        <div className="ws-card-body">
          <form onSubmit={(e) => void handleInvite(e)} className="form-grid">
            <div className="field">
              <label>Staff Full Name</label>
              <input
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="e.g. Chirag Patel"
              />
            </div>
            <div className="field">
              <label>Work Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="chirag@firm.in"
              />
            </div>
            <div className="field">
              <label>RBAC Role</label>
              <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="Admin">Partner / Admin (Full Access)</option>
                <option value="Audit Head">Audit Head (Banking + Vouchers + Tally)</option>
                <option value="GST Executive">GST Executive (GSTR-1/2B/IMS/3B)</option>
                <option value="Article Assistant">Article Assistant (Upload &amp; OCR)</option>
              </select>
            </div>
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-cobalt">
                Invite Member
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
                <th>Member</th>
                <th>Role</th>
                <th>Module Scopes</th>
                <th className="num">Vouchers Processed</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{u.full_name}</div>
                    <div style={{ fontSize: '12px', color: '#475569' }}>{u.email}</div>
                  </td>
                  <td>
                    <span className="badge badge-info">{u.role}</span>
                  </td>
                  <td className="mono">{u.permissions_json}</td>
                  <td className="num">{u.vouchers_processed.toLocaleString('en-IN')}</td>
                  <td>
                    <span className="badge badge-ok">{u.status}</span>
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

export function ActivityLogsPage() {
  const { activeCompanyId } = useWorkspace();
  const [logs, setLogs] = useState<
    { id: number; actor: string; module: string; action: string; created_at: string }[]
  >([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/activity-logs?companyId=${activeCompanyId}`);
      if (res.ok) {
        const data = (await res.json()) as { logs: typeof logs };
        setLogs(data.logs);
      }
    })();
  }, [activeCompanyId]);

  return (
    <WorkspaceLayout>
      <div className="ws-page-header">
        <div>
          <h1 className="ws-page-title">Practice Activity &amp; Tally Sync Audit Trail</h1>
          <p className="ws-page-sub">Immutable chronological log of accounting, IMS, and XML sync operations.</p>
        </div>
      </div>
      <div className="ws-card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Actor</th>
                <th>Module</th>
                <th>Operation Details</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="mono">#{l.id}</td>
                  <td style={{ fontWeight: 600 }}>{l.actor}</td>
                  <td>
                    <span className="badge badge-neutral">{l.module}</span>
                  </td>
                  <td>{l.action}</td>
                  <td className="mono">{l.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </WorkspaceLayout>
  );
}
