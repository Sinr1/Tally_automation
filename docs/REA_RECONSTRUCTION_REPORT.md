# Vyapar TaxOne (`taxone.vyapar.com`) — `morluto/rea` Reverse-Engineering & Full-Stack Reconstruction Report

## 1. Investigation Tooling & Provenance Chain

This reconstruction was performed using **[`morluto/rea`](https://github.com/morluto/rea)** (`rea-agents` v6.9.0) following its shipped-artifact & runtime browser scenario workflow (`capture-browser-scenario` -> `export-web-scripts` -> `analyze-javascript-application` -> `inspect-analysis-view`).

| Stage | REA Operation | Cryptographic Evidence ID | Subject / Capture SHA-256 Digest | Target |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `capture_browser_scenario` | `ev_ab6ef1990289e36ef8d15c177460602c397d0eba5f6cf25e40065041924a5bf9` | `6b7047a773d29b3d62615c177460602c397d0eba5f6cf25e40065041924a5bf9` / `6b7047a773d29b3d62615c754bcd5be83b1c9c84b6e3da5777130b43f3ca4850` | `https://taxone.vyapar.com/` (Next.js Public Site) |
| 2 | `export_web_scripts` | `ev_f61ac8d04417db3f79e760bd185705344b751998ea8d43b971e1bb021f268112` | `783b33e3f4c5ac353a8d4e0d01cdfe6bf6b8431c4eb7e051447f413aa0ae56f1` | 22 Next.js client chunks (`_next/static/chunks/*`) |
| 3 | `analyze_javascript_application` | `ev_883ac2a8a95464a7bfe5b751c3128c8f1f25c79b6c8b1db537f203bda6f500e6` | `783b33e3f4c5ac353a8d4e0d01cdfe6bf6b8431c4eb7e051447f413aa0ae56f1` | Route Inventory (`ev_871908480a0ee2374c585ffbaaa8050faab0e71ac8aa6f604d8cf4d15c92b0f2`, 20 routes) |
| 4 | `capture_browser_scenario` | `ev_1e2972dbf12bab643311b13307a5db9d186625f557214f53e280dd6936473dd1` | `7dbeb51c43d7addd809fffc8bb2d537ae80eff8a06c5d8b7b060b1cb7381c309` | `https://taxone.vyapar.com/app/signIn` (64 MiB network body capture) |
| 5 | `export_web_scripts` | `ev_fa905b773e33ca4fc6f96ce1f2d94177cd607346fe243618e21f2aabbde17564` | `9ec0d4795b749391801670a94672954f5332b036f2c28a47465ee6385e9e36b6` | `/app/static/js/main.060bc231.js` (`20,045,981` bytes) |
| 6 | `analyze_javascript_application` | `ev_e41ed5624ad396558d96b81d47852015bac6ebc34d4c12a9abb68a24f9e0a854` | `9ec0d4795b749391801670a94672954f5332b036f2c28a47465ee6385e9e36b6` | Monolithic SPA Analysis (`ev_f09964bcd7b633a26e863fcb4daa6b6c27446db7151a70f81469bc94894c14f2`) |

---

## 2. Recovered Product Architecture

`morluto/rea` uncovered that **Vyapar TaxOne** is the rebranded evolution of **Suvit** (`webpackChunksuvit_frontend` — *"Suvit Is Now Vyapar TaxOne | Same Trust, New Name!"*), built as a dual-surface product:

1. **Public Website & Statutory Calculators (`/` Next.js App Router)**:
   - `/` Home, `/data-entry-automation-feature`, `/gst-reconciliation-feature`, `/taxone-chat`
   - `/pricing` (Unlimited CA Practice Plan: ₹14,000 list -> 50% off ₹7,000/yr + 18% GST, 1 Yr vs 3 Yr Save 20% toggle, 7-day free trial)
   - `/calculators` (GST, 2026 6-Digit HSN/SAC Finder, Income Tax Regime Comparator, Salary, Gratuity, PPF, FD, RD)
   - `/contact-us` (9th Floor, Infinity Tower, Surat, Gujarat — `+91 9558261955`, `taxonesupport@vyapar.com`)

2. **Authenticated 6-Module CA Enterprise SPA (`/app/*`)**:
   - **Practice Home (`/app/home/*`)**: Subscribed Tally/Vyapar companies, Tally Connector port `9000` status, Client directory, Staff RBAC & productivity report, Activity audit trail.
   - **Data Entry Automation (`/app/da/*`)**:
     - Banking Statement upload (`.xlsx`/`.csv`), Smart Keyword Categorization Rules, Cross-Company Rule Cloning, Orange-Flag Duplicate Guard, and TallyPrime XML push.
     - Sales & Purchase 3-Step Excel / E-Commerce (Amazon, Flipkart, Meesho) Column-to-Tally Mapping Wizard + Split-Pane AI Invoice OCR Scanner.
     - Cloud Manual Vouchers (`Sales`, `Purchase`, `Credit Note`, `Debit Note`, `Journal`, `Payment`, `Receipt`, `Contra`), Party Ledgers & Stock Item Masters + Cross-Company Cloning, and 1-Click Vyapar App Sync.
   - **GST Automation (`/app/ga/*`)**:
     - **32 Smart GST Validations** (Modulo-36 GSTIN check digit, POS vs CGST/SGST/IGST mismatch, 6-digit HSN, Rule 46 16-char invoice limit, Duplicate bill guard, RCM u/s 9(3), Blocked ITC u/s 17(5), Rule 86B) with **1-Click Auto-Fix**.
     - **GSTR-1 / 2A / 2B & IMS Reconciliation** across Summary View, Month View, Voucher View, and Supplier Compliance Scorecard, with live **IMS `Accept` / `Pending` / `Reject`** actions.
     - **GSTR-1 Official GSTN `.json` Generator** & **GSTR-3B Section 49A / Rule 88A Cross-Utilization Offset Calculator**, plus GST Notices (`ASMT-10`, `DRC-01`) tracker.
   - **Vyapar TaxOne Chat (`/app/chat/*`)**: Shared team WhatsApp inbox, 1-click attachment forwarding to `Banking`/`Sales`/`Purchase`/`Drive`, and scheduled monthly reminders.
   - **Practice Management PMS (`/app/pms/*`)**: CA staff task assignment & status workflows.
   - **TaxOne Drive (`/app/drive/*`) & Chanakya AI (`/app/chanakya-ai`)**: Client document vault with transfer approval + live-books & statutory CA GPT assistant.
