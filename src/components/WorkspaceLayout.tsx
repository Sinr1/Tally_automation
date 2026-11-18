import {
  Activity,
  Bot,
  Building2,
  CheckSquare,
  Code2,
  Database,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FolderKanban,
  HardDrive,
  Home,
  Landmark,
  Layers,
  Menu,
  MessageSquare,
  RefreshCw,
  Scale,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext.tsx';
import { BrandLogo } from './BrandLogo.tsx';

function downloadTextFile(filename: string, content: string, mime = 'application/xml') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function WorkspaceLayout({ children }: { children: ReactNode }) {
  const {
    user,
    companies,
    activeCompany,
    activeCompanyId,
    setActiveCompanyId,
    toast,
    showToast,
    xmlModal,
    setXmlModal,
  } = useWorkspace();
  const location = useLocation();
  const [mobileSideOpen, setMobileSideOpen] = useState(false);

  const p = location.pathname;
  const activeMod = p.startsWith('/app/da')
    ? 'da'
    : p.startsWith('/app/ga')
      ? 'ga'
      : p.startsWith('/app/chat')
        ? 'chat'
        : p.startsWith('/app/pms')
          ? 'pms'
          : p.startsWith('/app/drive')
            ? 'drive'
            : p.startsWith('/app/chanakya')
              ? 'ai'
              : p.startsWith('/app/rea')
                ? 'rea'
                : 'home';

  const handleExportMastersXml = async () => {
    const res = await fetch(`/api/tally/xml/masters?companyId=${activeCompanyId}`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      filename: string;
      xml: string;
      ledgerCount: number;
      itemCount: number;
    };
    setXmlModal({
      title: `TallyPrime Masters <ENVELOPE> — ${activeCompany?.tally_company_name || ''}`,
      filename: data.filename,
      xml: data.xml,
      subtitle: `${data.ledgerCount} Party/GL Ledgers + ${data.itemCount} Stock Items ready for TallyPrime Port ${activeCompany?.tally_connector_port || 9000}`,
    });
  };

  return (
    <div className="ws-shell">
      <header className="ws-topbar">
        <div className="ws-topbar-left">
          <button
            type="button"
            className="btn btn-secondary btn-sm mobile-only-btn"
            onClick={() => setMobileSideOpen((v) => !v)}
            aria-label="Toggle Sidebar"
          >
            {mobileSideOpen ? <X size={16} /> : <Menu size={16} />}
          </button>

          <Link to="/" title="Back to Public Website">
            <BrandLogo subtitle="CA Practice Suite" />
          </Link>

          <nav className="ws-module-tabs" aria-label="Workspace Modules">
            <Link
              to="/app/home/dashboard"
              className={`ws-mod-tab ${activeMod === 'home' ? 'active' : ''}`}
            >
              <Home size={14} /> Practice Home
            </Link>
            <Link
              to="/app/da/banking"
              className={`ws-mod-tab ${activeMod === 'da' ? 'active' : ''}`}
            >
              <Database size={14} /> Data Automation
            </Link>
            <Link
              to="/app/ga/dashboard"
              className={`ws-mod-tab ${activeMod === 'ga' ? 'active' : ''}`}
            >
              <Scale size={14} /> GST Automation
            </Link>
            <Link
              to="/app/chat"
              className={`ws-mod-tab ${activeMod === 'chat' ? 'active' : ''}`}
            >
              <MessageSquare size={14} /> TaxOne Chat
            </Link>
            <Link
              to="/app/pms"
              className={`ws-mod-tab ${activeMod === 'pms' ? 'active' : ''}`}
            >
              <CheckSquare size={14} /> PMS Tasks
            </Link>
            <Link
              to="/app/drive"
              className={`ws-mod-tab ${activeMod === 'drive' ? 'active' : ''}`}
            >
              <HardDrive size={14} /> Drive
            </Link>
            <Link
              to="/app/chanakya-ai"
              className={`ws-mod-tab ${activeMod === 'ai' ? 'active' : ''}`}
            >
              <Bot size={14} /> Chanakya AI
            </Link>
            <Link
              to="/app/rea-evidence"
              className={`ws-mod-tab ${activeMod === 'rea' ? 'active' : ''}`}
            >
              <ShieldCheck size={14} /> REA Provenance
            </Link>
          </nav>
        </div>

        <div className="ws-topbar-right">
          <select
            className="ws-company-select"
            value={activeCompanyId}
            onChange={(e) => {
              const nextId = Number(e.target.value);
              setActiveCompanyId(nextId);
              const found = companies.find((c) => c.id === nextId);
              if (found) showToast(`Switched active company to ${found.trade_name} (${found.gstin})`);
            }}
            aria-label="Active Client Company"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.trade_name} ({c.state_code}-{c.gstin.slice(0, 15)})
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void handleExportMastersXml()}
            title="Inspect TallyPrime All-Masters XML Envelope"
          >
            <Code2 size={14} /> Tally XML
          </button>
        </div>
      </header>

      <div className="ws-body">
        <aside
          className={`ws-sidebar ${mobileSideOpen ? 'mobile-open' : ''}`}
          onClick={() => setMobileSideOpen(false)}
        >
          <div>
            {activeMod === 'home' && (
              <>
                <div className="ws-side-group-title">Practice Administration</div>
                <NavLink to="/app/home/dashboard" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <Home size={15} /> Practice Dashboard
                  </span>
                </NavLink>
                <NavLink to="/app/home/company" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <Building2 size={15} /> Subscribed Companies
                  </span>
                </NavLink>
                <NavLink to="/app/home/clients" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <FolderKanban size={15} /> Client Directory
                  </span>
                </NavLink>
                <NavLink to="/app/home/users" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <Users size={15} /> Team Users &amp; RBAC
                  </span>
                </NavLink>
                <NavLink to="/app/activity-log" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <Activity size={15} /> Activity Audit Log
                  </span>
                </NavLink>
              </>
            )}

            {activeMod === 'da' && (
              <>
                <div className="ws-side-group-title">Data Entry Automation</div>
                <NavLink to="/app/da/banking" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <Landmark size={15} /> Banking Statement
                  </span>
                </NavLink>
                <NavLink to="/app/da/rulelist" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <RefreshCw size={15} /> Smart Bank Rules
                  </span>
                </NavLink>
                <NavLink to="/app/da/sales" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <FileSpreadsheet size={15} /> Sales &amp; E-Com / OCR
                  </span>
                </NavLink>
                <NavLink to="/app/da/purchase" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <FileSpreadsheet size={15} /> Purchase &amp; Bill OCR
                  </span>
                </NavLink>
                <NavLink to="/app/da/add-vouchers" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <FileCheck2 size={15} /> Cloud Vouchers &amp; JV
                  </span>
                </NavLink>
                <NavLink to="/app/da/ledger-master" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <Layers size={15} /> Ledger &amp; Item Masters
                  </span>
                </NavLink>
                <NavLink to="/app/da/vyapar" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <RefreshCw size={15} /> Vyapar App Sync
                  </span>
                </NavLink>
              </>
            )}

            {activeMod === 'ga' && (
              <>
                <div className="ws-side-group-title">GST Compliance &amp; IMS</div>
                <NavLink to="/app/ga/dashboard" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <Scale size={15} /> GST Compliance Hub
                  </span>
                </NavLink>
                <NavLink to="/app/ga/audit/reviewAndFix" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <ShieldCheck size={15} /> 32 Smart Validations
                  </span>
                </NavLink>
                <NavLink to="/app/ga/audit/ims" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <FileCheck2 size={15} /> GSTR-2B &amp; IMS Reco
                  </span>
                </NavLink>
                <NavLink to="/app/ga/audit/gstr1" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <FileSpreadsheet size={15} /> GSTR-1 Books vs Portal
                  </span>
                </NavLink>
                <NavLink to="/app/ga/return-filing" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <Code2 size={15} /> GSTR-1 JSON Filing
                  </span>
                </NavLink>
                <NavLink to="/app/ga/gstr3b-filing" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <Landmark size={15} /> GSTR-3B Rule 88A Offset
                  </span>
                </NavLink>
                <NavLink to="/app/ga/notice-order" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <Activity size={15} /> GST Notices &amp; Orders
                  </span>
                </NavLink>
              </>
            )}

            {(activeMod === 'chat' ||
              activeMod === 'pms' ||
              activeMod === 'drive' ||
              activeMod === 'ai' ||
              activeMod === 'rea') && (
              <>
                <div className="ws-side-group-title">Practice Collaboration</div>
                <NavLink to="/app/chat" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <MessageSquare size={15} /> WhatsApp Client Inbox
                  </span>
                </NavLink>
                <NavLink to="/app/pms" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <CheckSquare size={15} /> PMS Task Board
                  </span>
                </NavLink>
                <NavLink to="/app/drive" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <HardDrive size={15} /> TaxOne Drive Vault
                  </span>
                </NavLink>
                <NavLink to="/app/chanakya-ai" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <Bot size={15} /> Chanakya AI (CA GPT)
                  </span>
                </NavLink>
                <NavLink to="/app/rea-evidence" className="ws-side-link">
                  <span className="ws-side-link-inner">
                    <ShieldCheck size={15} /> REA Evidence Chain
                  </span>
                </NavLink>
              </>
            )}
          </div>

          <div
            style={{
              padding: '12px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '12px',
            }}
          >
            <div style={{ fontWeight: 700, color: '#0f172a' }}>{user.full_name}</div>
            <div style={{ color: '#475569', marginBottom: '6px' }}>
              {user.role} · FY {activeCompany?.financial_year || '2025-26'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#166534', fontWeight: 600 }}>
              <span>●</span> Tally Port {activeCompany?.tally_connector_port || 9000} Ready
            </div>
          </div>
        </aside>

        <main className="ws-main">{children}</main>
      </div>

      {xmlModal ? (
        <div className="modal-backdrop" onClick={() => setXmlModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="ws-card-head">
              <div>
                <h3>{xmlModal.title}</h3>
                {xmlModal.subtitle ? (
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                    {xmlModal.subtitle}
                  </div>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-cobalt btn-sm"
                  onClick={() => {
                    downloadTextFile(
                      xmlModal.filename,
                      xmlModal.xml,
                      xmlModal.filename.endsWith('.json')
                        ? 'application/json'
                        : 'application/xml'
                    );
                    showToast(`Downloaded ${xmlModal.filename}`);
                  }}
                >
                  <Download size={14} /> Download {xmlModal.filename}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setXmlModal(null)}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="modal-body">
              <pre className="xml-pre">{xmlModal.xml}</pre>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className="toast-banner">{toast}</div> : null}
    </div>
  );
}
