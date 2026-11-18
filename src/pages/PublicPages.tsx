import {
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Landmark,
  MessageSquare,
  Phone,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo.tsx';
import { PublicLayout } from '../components/PublicLayout.tsx';
import { useWorkspace, type AuthUser } from '../context/WorkspaceContext.tsx';

export function HomePage() {
  const [previewTab, setPreviewTab] = useState<'banking' | 'gst' | 'tally'>('banking');

  return (
    <PublicLayout>
      <section className="pub-hero">
        <div className="pub-container">
          <div className="pub-hero-grid">
            <div>
              <span className="eyebrow-label">AI Pre-Accounting &amp; CA Practice Platform</span>
              <h1 className="pub-h1">
                Eliminate Manual Tally Entry &amp; Reconcile GST in Minutes.
              </h1>
              <p className="pub-lead">
                Vyapar TaxOne (formerly Suvit) automates bank statements, bulk sales &amp; purchase
                Excel sheets, scanned OCR bills, 32-rule GST validation, GSTR-2B IMS actions, and
                WhatsApp client follow-ups — syncing straight into TallyPrime.
              </p>

              <div className="hero-cta-row">
                <Link to="/app/home/dashboard" className="btn btn-crimson btn-lg">
                  Open Live CA Workspace <ArrowRight size={17} />
                </Link>
                <Link to="/pricing" className="btn btn-secondary btn-lg">
                  View Unlimited Plan (₹7,000/yr)
                </Link>
              </div>

              <div className="hero-trust-strip">
                <span className="hero-trust-item">
                  <CheckCircle2 size={16} color="#15803d" /> Unlimited Companies &amp; Users
                </span>
                <span className="hero-trust-item">
                  <CheckCircle2 size={16} color="#15803d" /> Native TallyPrime XML Envelope
                </span>
                <span className="hero-trust-item">
                  <CheckCircle2 size={16} color="#15803d" /> GSTR-1 / 2A / 2B / IMS / 3B
                </span>
              </div>
            </div>

            {/* Interactive Live Product Preview Workbench */}
            <div className="clean-panel" style={{ padding: '18px', boxShadow: 'var(--shadow-md)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '14px',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '13px' }}>
                  Live Pre-Accounting Engine Preview
                </span>
                <div className="sub-tabs">
                  <button
                    type="button"
                    className={`sub-tab ${previewTab === 'banking' ? 'active' : ''}`}
                    onClick={() => setPreviewTab('banking')}
                  >
                    Banking Rules
                  </button>
                  <button
                    type="button"
                    className={`sub-tab ${previewTab === 'gst' ? 'active' : ''}`}
                    onClick={() => setPreviewTab('gst')}
                  >
                    32-Rule GST
                  </button>
                  <button
                    type="button"
                    className={`sub-tab ${previewTab === 'tally' ? 'active' : ''}`}
                    onClick={() => setPreviewTab('tally')}
                  >
                    Tally XML
                  </button>
                </div>
              </div>

              {previewTab === 'banking' && (
                <div>
                  <table className="data-table" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th>Narration</th>
                        <th className="num">Amount</th>
                        <th>Auto-Ledger</th>
                        <th>Guard</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>RTGS CR-PATEL SYNTHETICS-INV101</td>
                        <td className="num">+₹2,95,000</td>
                        <td>Patel Synthetics Ltd</td>
                        <td>
                          <span className="badge badge-ok">Receipt</span>
                        </td>
                      </tr>
                      <tr className="dup-row">
                        <td>BIL/00948210/DGVCL POWER OCT</td>
                        <td className="num">-₹46,850</td>
                        <td>Electricity Charges</td>
                        <td>
                          <span className="badge badge-warn">Duplicate Flag</span>
                        </td>
                      </tr>
                      <tr>
                        <td>CHQ PAID-SELF CASH WITHDRAWAL</td>
                        <td className="num">-₹50,000</td>
                        <td>Cash-in-Hand</td>
                        <td>
                          <span className="badge badge-info">Contra</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div style={{ marginTop: '12px', textAlign: 'right' }}>
                    <Link to="/app/da/banking" className="btn btn-cobalt btn-sm">
                      Try Live Banking Upload →
                    </Link>
                  </div>
                </div>
              )}

              {previewTab === 'gst' && (
                <div>
                  <table className="data-table" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th>Rule</th>
                        <th>Detected Issue</th>
                        <th>1-Click Fix</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="mono">R01</td>
                        <td>Modulo-36 GSTIN Checksum Typo</td>
                        <td>
                          <span className="badge badge-err">Auto-Repair Digit</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="mono">R04</td>
                        <td>Intra-State POS 24-GJ Charged IGST</td>
                        <td>
                          <span className="badge badge-err">Split CGST+SGST</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="mono">IMS</td>
                        <td>GSTR-2B Invoice ZIN-99402 Pending</td>
                        <td>
                          <span className="badge badge-ok">Accept / Reject</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div style={{ marginTop: '12px', textAlign: 'right' }}>
                    <Link to="/app/ga/audit/reviewAndFix" className="btn btn-cobalt btn-sm">
                      Run 32 GST Validations →
                    </Link>
                  </div>
                </div>
              )}

              {previewTab === 'tally' && (
                <div>
                  <pre className="xml-pre" style={{ maxHeight: '175px', fontSize: '11.5px' }}>
{`<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <PARTYLEDGERNAME>Patel Synthetics &amp; Yarns Ltd</PARTYLEDGERNAME>
            <AMOUNT>-295000.00</AMOUNT>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`}
                  </pre>
                  <div style={{ marginTop: '12px', textAlign: 'right' }}>
                    <Link to="/app/da/sales" className="btn btn-cobalt btn-sm">
                      Generate Tally XML →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="pub-section">
        <div className="pub-container">
          <div className="section-head">
            <span className="eyebrow-label">6 Integrated CA Practice Modules</span>
            <h2 className="pub-h2">Built Around Real Indian Chartered Accountancy Workflows</h2>
          </div>

          <div className="feature-split-grid">
            <div className="clean-panel">
              <div style={{ marginBottom: '12px', color: '#ed1a3b' }}>
                <Landmark size={24} />
              </div>
              <h3>Data Entry &amp; Banking Automation</h3>
              <p>
                Convert PDF/Excel/CSV bank statements, Amazon/Flipkart/Meesho sheets, and scanned
                purchase bills into TallyPrime vouchers in 3 clicks.
              </p>
              <ul className="check-list">
                <li>
                  <CheckCircle2 size={15} color="#15803d" /> Smart Keyword Categorization &amp; Rule
                  Cloning
                </li>
                <li>
                  <CheckCircle2 size={15} color="#15803d" /> Orange-Flag Duplicate Statement Guard
                </li>
                <li>
                  <CheckCircle2 size={15} color="#15803d" /> 3-Step Excel Column to Tally GST Wizard
                </li>
              </ul>
            </div>

            <div className="clean-panel">
              <div style={{ marginBottom: '12px', color: '#1a48d3' }}>
                <Scale size={24} />
              </div>
              <h3>GST Reconciliation, IMS &amp; 3B</h3>
              <p>
                Reconcile Tally books against GSTR-1, GSTR-2A, and GSTR-2B across Summary, Month,
                Voucher, and Vendor Compliance views.
              </p>
              <ul className="check-list">
                <li>
                  <CheckCircle2 size={15} color="#15803d" /> 32 Smart GST Validations + 1-Click Fix
                </li>
                <li>
                  <CheckCircle2 size={15} color="#15803d" /> Live IMS Accept / Reject / Pending ITC
                </li>
                <li>
                  <CheckCircle2 size={15} color="#15803d" /> Section 49A / Rule 88A GSTR-3B Offset
                </li>
              </ul>
            </div>

            <div className="clean-panel">
              <div style={{ marginBottom: '12px', color: '#15803d' }}>
                <MessageSquare size={24} />
              </div>
              <h3>TaxOne WhatsApp Chat, PMS &amp; Drive</h3>
              <p>
                Centralize client WhatsApp document collection, automated GST due-date reminders,
                staff task boards, and Chanakya AI CA GPT.
              </p>
              <ul className="check-list">
                <li>
                  <CheckCircle2 size={15} color="#15803d" /> 1-Click Forward Chat File to Banking /
                  OCR
                </li>
                <li>
                  <CheckCircle2 size={15} color="#15803d" /> Automated Monthly Client Follow-ups
                </li>
                <li>
                  <CheckCircle2 size={15} color="#15803d" /> Chanakya AI Live Books &amp; Sec 43B(h)
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

export function FeaturePage({
  variant,
}: {
  variant: 'data-entry' | 'gst-reco' | 'chat';
}) {
  const meta = {
    'data-entry': {
      eyebrow: 'Data Entry Automation Suite (/app/da/*)',
      title: '10x Faster Bank Statement, Bulk Excel & OCR Bill Entry into TallyPrime',
      lead: 'Stop typing bank narrations and e-commerce spreadsheets line by line. Upload Excel, CSV, or scanned bills, review auto-mapped Tally ledgers, and sync via Tally XML.',
      ctaRoute: '/app/da/banking',
      ctaLabel: 'Open Banking & Bulk Automation',
      cards: [
        {
          title: 'Banking Smart Rules & Duplicate Guard',
          body: 'Auto-assign Payment, Receipt, and Contra ledgers from NEFT/RTGS/UPI narrations. Duplicate overlap rows are highlighted in amber before Tally push.',
        },
        {
          title: '3-Step Bulk Sales, Purchase & E-Com Wizard',
          body: 'Map Amazon B2B/B2C, Flipkart, Meesho, or custom ERP columns to Tally fields with automatic Intra-State (CGST+SGST) vs Inter-State (IGST) calculation.',
        },
        {
          title: 'Split-Pane Invoice OCR & Cross-Company Cloning',
          body: 'Verify scanned PDF/image invoices side-by-side and clone Party Ledgers, Stock Items, and Bank Rules across client companies.',
        },
      ],
    },
    'gst-reco': {
      eyebrow: 'GST Compliance & IMS Suite (/app/ga/*)',
      title: '32 Smart GST Validations, GSTR-2B IMS Actions & Rule 88A GSTR-3B Offset',
      lead: 'Catch Modulo-36 GSTIN typos, Place of Supply tax-head mismatches, and missing GSTR-2B supplier invoices before filing on the GST portal.',
      ctaRoute: '/app/ga/audit/ims',
      ctaLabel: 'Open GST & IMS Reconciliation',
      cards: [
        {
          title: '4-Dimensional Books vs Portal Reconciliation',
          body: 'Slice GSTR-1, GSTR-2A, and GSTR-2B variances across Summary View, Month View, Voucher View, and Supplier Compliance Scorecard.',
        },
        {
          title: 'Live Invoice Management System (IMS)',
          body: 'Mark portal-only or mismatched inward invoices as Accepted, Pending, or Rejected and watch Eligible ITC update instantaneously.',
        },
        {
          title: 'GSTR-1 JSON Export & GSTR-3B Cash Challan',
          body: 'Export GSTN-ready GSTR-1 JSON (Tables 4A, 5A, 7, 8, 9B, 12) and compute exact PMT-06 cash payable after IGST -> CGST -> SGST cross-utilization.',
        },
      ],
    },
    chat: {
      eyebrow: 'Vyapar TaxOne Chat & PMS (/app/chat & /app/pms)',
      title: 'Unified WhatsApp Client Communication, Document Collection & CA Task Management',
      lead: 'Never lose client bank statements or purchase bills in personal WhatsApp threads. Assign chats to article assistants and forward files straight to accounting modules.',
      ctaRoute: '/app/chat',
      ctaLabel: 'Open TaxOne WhatsApp Inbox',
      cards: [
        {
          title: 'Shared Team WhatsApp Inbox',
          body: 'Every client conversation shows staff attribution so partners know who requested documents and which bills were received.',
        },
        {
          title: '1-Click Forward to Banking, Sales, Purchase & Drive',
          body: 'Route client-uploaded PDFs and spreadsheets directly into Banking Automation, Invoice OCR, or TaxOne Drive Vault.',
        },
        {
          title: 'Automated GST & Audit Reminders',
          body: 'Schedule recurring WhatsApp + Email reminders for monthly purchase bills, GSTR-2B non-filing vendors, and GSTR-3B challan approvals.',
        },
      ],
    },
  }[variant];

  return (
    <PublicLayout>
      <section className="pub-hero">
        <div className="pub-container">
          <span className="eyebrow-label">{meta.eyebrow}</span>
          <h1 className="pub-h1" style={{ maxWidth: '24ch' }}>
            {meta.title}
          </h1>
          <p className="pub-lead">{meta.lead}</p>
          <div className="hero-cta-row">
            <Link to={meta.ctaRoute} className="btn btn-crimson btn-lg">
              {meta.ctaLabel} <ArrowRight size={16} />
            </Link>
            <Link to="/app/signIn" className="btn btn-secondary btn-lg">
              Start 7-Day Free Trial
            </Link>
          </div>
        </div>
      </section>

      <section className="pub-section">
        <div className="pub-container">
          <div className="feature-split-grid">
            {meta.cards.map((c) => (
              <div key={c.title} className="clean-panel">
                <div style={{ marginBottom: '10px', color: '#1a48d3' }}>
                  <FileSpreadsheet size={22} />
                </div>
                <h3>{c.title}</h3>
                <p style={{ marginBottom: 0 }}>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

export function PricingPage() {
  const [tenure, setTenure] = useState<'1yr' | '3yr'>('1yr');
  const [clientCount, setClientCount] = useState(35);

  const annualEffective = tenure === '1yr' ? 7000 : 5600;
  const listPrice = 14000;
  const billedExGst = tenure === '1yr' ? 7000 : 16800;
  const gstAmount = Math.round(billedExGst * 0.18);
  const hoursSavedPerMonth = Math.round(clientCount * 2.4);

  return (
    <PublicLayout>
      <section className="pub-section">
        <div className="pub-container">
          <div className="section-head">
            <span className="eyebrow-label">Simple Unlimited CA Practice Pricing</span>
            <h2 className="pub-h2">One Unlimited Plan. Unlimited Companies, Users &amp; Vouchers.</h2>
            <p style={{ color: 'var(--ink-secondary)', margin: '8px 0 20px' }}>
              Includes 7-Day Free Trial with full access to Data Automation, GST &amp; IMS, TaxOne
              Chat, PMS, Drive, and Chanakya AI.
            </p>

            <div className="sub-tabs">
              <button
                type="button"
                className={`sub-tab ${tenure === '1yr' ? 'active' : ''}`}
                onClick={() => setTenure('1yr')}
              >
                1 Year Plan (50% Off)
              </button>
              <button
                type="button"
                className={`sub-tab ${tenure === '3yr' ? 'active' : ''}`}
                onClick={() => setTenure('3yr')}
              >
                3 Years Plan (Extra 20% Off)
              </button>
            </div>
          </div>

          <div className="split-two">
            <div className="clean-panel" style={{ borderColor: '#0f172a', borderWidth: '1.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '20px', margin: 0 }}>Vyapar TaxOne Unlimited Practice</h3>
                <span className="badge badge-ok">50% Launch Offer</span>
              </div>

              <div style={{ margin: '18px 0' }}>
                <span
                  style={{
                    textDecoration: 'line-through',
                    color: '#64748b',
                    fontSize: '16px',
                    marginRight: '10px',
                  }}
                >
                  ₹{listPrice.toLocaleString('en-IN')}/yr
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '36px',
                    fontWeight: 800,
                  }}
                >
                  ₹{annualEffective.toLocaleString('en-IN')}
                </span>
                <span style={{ color: '#475569', fontSize: '14px' }}> / year + 18% GST</span>
                <div style={{ fontSize: '12.5px', color: '#475569', marginTop: '4px' }}>
                  Total Invoice: ₹{billedExGst.toLocaleString('en-IN')} + ₹
                  {gstAmount.toLocaleString('en-IN')} GST (18% Input Credit Eligible) ={' '}
                  <strong>₹{(billedExGst + gstAmount).toLocaleString('en-IN')}</strong>
                </div>
              </div>

              <ul className="check-list" style={{ marginBottom: '22px' }}>
                <li>
                  <CheckCircle2 size={16} color="#15803d" /> Unlimited TallyPrime &amp; Vyapar
                  Client Companies
                </li>
                <li>
                  <CheckCircle2 size={16} color="#15803d" /> Unlimited Article Assistants &amp; Audit
                  Staff Logins (RBAC)
                </li>
                <li>
                  <CheckCircle2 size={16} color="#15803d" /> Unlimited Bank Statements, Bulk Excel
                  &amp; OCR Invoices
                </li>
                <li>
                  <CheckCircle2 size={16} color="#15803d" /> Complete GSTR-1, 2A, 2B, IMS, 32-Rule
                  Audit &amp; GSTR-3B
                </li>
                <li>
                  <CheckCircle2 size={16} color="#15803d" /> TaxOne WhatsApp Chat, Bulk Reminders,
                  PMS &amp; Drive
                </li>
              </ul>

              <Link to="/app/signUp" className="btn btn-crimson btn-lg" style={{ width: '100%' }}>
                Start 7-Day Free Trial — No Card Required
              </Link>
            </div>

            <div className="clean-panel">
              <h3>Practice Time &amp; Cost Savings Estimator</h3>
              <p>Slide to estimate monthly staff hours saved across your subscribed GST clients:</p>

              <div className="field" style={{ marginBottom: '18px' }}>
                <label>
                  Active GST &amp; Tally Clients: <strong>{clientCount} Companies</strong>
                </label>
                <input
                  type="range"
                  min={5}
                  max={200}
                  value={clientCount}
                  onChange={(e) => setClientCount(Number(e.target.value))}
                />
              </div>

              <div className="kpi-strip" style={{ marginBottom: '16px' }}>
                <div className="kpi-cell">
                  <div className="kpi-label">Effective Cost / Client</div>
                  <div className="kpi-value">
                    ₹{Math.max(3, Math.round(annualEffective / 12 / clientCount))}/mo
                  </div>
                </div>
                <div className="kpi-cell">
                  <div className="kpi-label">Staff Hours Saved</div>
                  <div className="kpi-value">{hoursSavedPerMonth} hrs/mo</div>
                </div>
              </div>

              <div style={{ fontSize: '13px', color: '#475569' }}>
                Need multi-branch firm onboarding or custom Tally TDL connector support? Call{' '}
                <strong>+91 9558261955</strong> or email <strong>taxonesupport@vyapar.com</strong>.
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

export function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <PublicLayout>
      <section className="pub-section">
        <div className="pub-container">
          <div className="split-two">
            <div>
              <span className="eyebrow-label">Contact Sales &amp; CA Support</span>
              <h1 className="pub-h2">Speak With a Tally &amp; GST Automation Specialist</h1>
              <p style={{ color: 'var(--ink-secondary)', marginBottom: '24px' }}>
                Our onboarding engineers help your firm connect TallyPrime port 9000, migrate
                banking rules, and configure WhatsApp client reminders in 15 minutes.
              </p>

              <div className="clean-panel">
                <h3>Headquarters — Surat, Gujarat</h3>
                <p>
                  Suvit Fintech Pvt. Ltd. (Vyapar TaxOne)
                  <br />
                  9th Floor, Infinity Tower, Near Railway Station,
                  <br />
                  Surat, Gujarat — 395003, India
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px' }}>
                  <span>
                    <Phone size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                    <strong>+91 9558261955</strong> (Mon–Sat, 9:30 AM – 7:00 PM IST)
                  </span>
                  <span>
                    <ShieldCheck size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                    <strong>taxonesupport@vyapar.com</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="clean-panel">
              <h3>Schedule a Live Firm Demo</h3>
              {submitted ? (
                <div className="badge badge-ok" style={{ padding: '12px', fontSize: '13px' }}>
                  Callback request registered! Meanwhile, you can explore the full live CA workspace
                  immediately.
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSubmitted(true);
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
                >
                  <div className="field">
                    <label>Your Name / CA Membership</label>
                    <input className="input" required placeholder="CA Rajesh Sharma" />
                  </div>
                  <div className="field">
                    <label>WhatsApp / Mobile Number</label>
                    <input className="input" required placeholder="+91 98250 XXXXX" />
                  </div>
                  <div className="field">
                    <label>Firm Name &amp; City</label>
                    <input className="input" required placeholder="Sharma & Associates, Ahmedabad" />
                  </div>
                  <button type="submit" className="btn btn-crimson">
                    Request Specialist Callback
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

export function AuthPage({ mode }: { mode: 'signIn' | 'signUp' }) {
  const { setUser, showToast } = useWorkspace();
  const navigate = useNavigate();
  const [email, setEmail] = useState('ca.siddharth@mehtadeshmukh.in');
  const [fullName, setFullName] = useState('CA Siddharth Mehta');
  const [firmName, setFirmName] = useState('Mehta & Deshmukh Chartered Accountants');
  const [phone, setPhone] = useState('+91 98250 44190');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const endpoint = mode === 'signIn' ? '/api/auth/login' : '/api/auth/register';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, fullName, firmName, phone }),
    });
    if (res.ok) {
      const data = (await res.json()) as { user: AuthUser };
      setUser(data.user);
      showToast(`Signed in as ${data.user.full_name} (${data.user.role})`);
      navigate('/app/home/dashboard');
    }
  };

  const quickLogin = async (targetEmail: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail }),
    });
    if (res.ok) {
      const data = (await res.json()) as { user: AuthUser };
      setUser(data.user);
      showToast(`Logged into Demo Firm as ${data.user.full_name}`);
      navigate('/app/home/dashboard');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div className="clean-panel" style={{ width: '100%', maxWidth: '460px', padding: '28px' }}>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/">
            <BrandLogo subtitle="CA Cloud Portal" />
          </Link>
          <Link to="/" style={{ fontSize: '12.5px', color: '#475569' }}>
            ← Website
          </Link>
        </div>

        <h1 style={{ fontSize: '20px', margin: '0 0 6px', fontFamily: 'var(--font-display)' }}>
          {mode === 'signIn' ? 'Sign In to Vyapar TaxOne' : 'Start Your 7-Day Free CA Trial'}
        </h1>
        <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 18px' }}>
          Access TallyPrime Data Automation, 32-Rule GST Audit, IMS &amp; WhatsApp Client Chat.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {mode === 'signUp' && (
            <>
              <div className="field">
                <label>Full Name</label>
                <input
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>CA Firm / Enterprise Name</label>
                <input
                  className="input"
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>WhatsApp Mobile</label>
                <input
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <div className="field">
            <label>Work Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label>OTP / Passkey (Pre-verified in Sandbox)</label>
            <input type="password" className="input" defaultValue="994210" />
          </div>

          <button type="submit" className="btn btn-cobalt btn-lg" style={{ marginTop: '4px' }}>
            {mode === 'signIn' ? 'Sign In to Workspace' : 'Create Practice Account'}
          </button>
        </form>

        <div
          style={{
            marginTop: '18px',
            paddingTop: '16px',
            borderTop: '1px solid #e2e8f0',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
            1-CLICK DEMO PRACTICE PERSONAS:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void quickLogin('ca.siddharth@mehtadeshmukh.in')}
            >
              CA Siddharth (Admin)
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void quickLogin('neha.gst@mehtadeshmukh.in')}
            >
              Neha (GST Desk)
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void quickLogin('rohan.audit@mehtadeshmukh.in')}
            >
              Rohan (Audit Head)
            </button>
          </div>
        </div>

        <div style={{ marginTop: '16px', fontSize: '12.5px', textAlign: 'center', color: '#475569' }}>
          {mode === 'signIn' ? (
            <>
              New to Vyapar TaxOne?{' '}
              <Link to="/app/signUp" style={{ color: '#1a48d3', fontWeight: 600 }}>
                Start 7-Day Free Trial
              </Link>
            </>
          ) : (
            <>
              Already registered?{' '}
              <Link to="/app/signIn" style={{ color: '#1a48d3', fontWeight: 600 }}>
                Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
