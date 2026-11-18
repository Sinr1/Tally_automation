import { ArrowRight, Menu, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { BrandLogo } from './BrandLogo.tsx';

export function PublicLayout({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div>
      <div className="rebrand-strip">
        <span>
          <strong>Suvit Is Now Vyapar TaxOne</strong> — Same CA Trust, Upgraded AI Tally &amp; GST
          Automation!
        </span>
        <Link to="/app/home/dashboard" style={{ textDecoration: 'underline', fontWeight: 600 }}>
          Open Live CA Workspace →
        </Link>
      </div>

      <header className="pub-header">
        <div className="pub-container">
          <div className="pub-nav-row">
            <Link to="/">
              <BrandLogo subtitle="Formerly Suvit" />
            </Link>

            <nav className="pub-nav-links" aria-label="Primary Navigation">
              <NavLink to="/data-entry-automation-feature">Data Entry Automation</NavLink>
              <NavLink to="/gst-reconciliation-feature">GST Compliance &amp; IMS</NavLink>
              <NavLink to="/taxone-chat">TaxOne Chat</NavLink>
              <NavLink to="/pricing">Pricing</NavLink>
              <NavLink to="/calculators">Calculators &amp; HSN</NavLink>
              <NavLink to="/contact-us">Contact</NavLink>
            </nav>

            <div className="pub-nav-actions">
              <Link to="/app/signIn" className="btn btn-secondary">
                Sign In
              </Link>
              <Link to="/app/home/dashboard" className="btn btn-crimson">
                Launch CA App <ArrowRight size={15} />
              </Link>
              <button
                type="button"
                className="btn btn-secondary btn-sm mobile-only-btn"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="Toggle Menu"
              >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="pub-mobile-menu" onClick={() => setMobileMenuOpen(false)}>
            <Link to="/data-entry-automation-feature">Data Entry Automation</Link>
            <Link to="/gst-reconciliation-feature">GST Reconciliation &amp; IMS</Link>
            <Link to="/taxone-chat">Vyapar TaxOne Chat</Link>
            <Link to="/pricing">Pricing (50% Off)</Link>
            <Link to="/calculators">8 Tax Calculators &amp; 2026 HSN Finder</Link>
            <Link to="/contact-us">Contact Us</Link>
            <Link to="/app/home/dashboard" style={{ color: '#ed1a3b' }}>
              Launch Live CA Workspace →
            </Link>
          </div>
        ) : null}
      </header>

      <main>{children}</main>

      <footer className="pub-footer">
        <div className="pub-container">
          <div className="pub-footer-grid">
            <div>
              <div style={{ marginBottom: '12px' }}>
                <BrandLogo />
              </div>
              <p style={{ fontSize: '13.5px', lineHeight: 1.6, margin: '0 0 14px', maxWidth: '34ch' }}>
                AI pre-accounting, TallyPrime XML automation, 32-rule GST audit, GSTR-2B IMS
                reconciliation, and WhatsApp client practice management for Indian CAs.
              </p>
              <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                9th Floor, Infinity Tower, Near Railway Station, Surat, Gujarat — 395003
                <br />
                Support: +91 9558261955 · taxonesupport@vyapar.com
              </div>
            </div>

            <div>
              <h4>Core Platform</h4>
              <ul>
                <li>
                  <Link to="/data-entry-automation-feature">Banking &amp; Bulk Excel to Tally</Link>
                </li>
                <li>
                  <Link to="/gst-reconciliation-feature">GSTR-1, 2A, 2B &amp; IMS Reco</Link>
                </li>
                <li>
                  <Link to="/taxone-chat">WhatsApp Client Chat &amp; PMS</Link>
                </li>
                <li>
                  <Link to="/app/chanakya-ai">Chanakya AI (CA GPT)</Link>
                </li>
              </ul>
            </div>

            <div>
              <h4>CA Resources</h4>
              <ul>
                <li>
                  <Link to="/calculators">GST, Income Tax &amp; Salary Calculators</Link>
                </li>
                <li>
                  <Link to="/calculators">2026 6-Digit HSN/SAC Finder</Link>
                </li>
                <li>
                  <Link to="/pricing">Subscription Plans</Link>
                </li>
                <li>
                  <Link to="/app/rea-evidence">REA Reconstruction Provenance</Link>
                </li>
              </ul>
            </div>

            <div>
              <h4>Quick Workspace Links</h4>
              <ul>
                <li>
                  <Link to="/app/da/banking">Banking Statement Automation</Link>
                </li>
                <li>
                  <Link to="/app/ga/audit/reviewAndFix">32 Smart GST Validations</Link>
                </li>
                <li>
                  <Link to="/app/ga/audit/ims">IMS Accept / Reject Workbench</Link>
                </li>
                <li>
                  <Link to="/app/ga/gstr3b-filing">GSTR-3B Rule 88A Offset</Link>
                </li>
              </ul>
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid #1e293b',
              paddingTop: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              fontSize: '12.5px',
              color: '#94a3b8',
            }}
          >
            <span>© 2026 Vyapar TaxOne (Suvit Fintech Pvt. Ltd.). Rebuilt with morluto/rea.</span>
            <span>ISO 27001 Architecture · TallyPrime XML v2 · GSTN Schema v3.1.6</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
