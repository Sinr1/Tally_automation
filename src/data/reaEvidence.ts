export interface ReaEvidenceItem {
  evidenceId: string;
  operation: string;
  predicateType: string;
  target: string;
  sha256Digest: string;
  summary: string;
}

export const REA_EVIDENCE_CHAIN: ReaEvidenceItem[] = [
  {
    evidenceId: 'ev_ab6ef1990289e36ef8d15c177460602c397d0eba5f6cf25e40065041924a5bf9',
    operation: 'capture_browser_scenario',
    predicateType: 'rea.browser-scenario-capture',
    target: 'https://taxone.vyapar.com/ (Public Next.js Application)',
    sha256Digest: '6b7047a773d29b3d62615c754bcd5be83b1c9c84b6e3da5777130b43f3ca4850',
    summary:
      'Playwright scenario capture recovering full DOM snapshot, 3 Next.js CSS stylesheets, network HAR payloads, and rendered viewport PNG.',
  },
  {
    evidenceId: 'ev_f61ac8d04417db3f79e760bd185705344b751998ea8d43b971e1bb021f268112',
    operation: 'export_web_scripts',
    predicateType: 'rea.web-script-export',
    target: 'taxone.vyapar.com/_next/static/chunks/* (22 Next.js Chunks)',
    sha256Digest: '783b33e3f4c5ac353a8d4e0d01cdfe6bf6b8431c4eb7e051447f413aa0ae56f1',
    summary:
      'Exported all 22 shipped Next.js client chunks covering Home, Data Entry Automation, GST Reconciliation, TaxOne Chat, Pricing, and 7 Calculators.',
  },
  {
    evidenceId: 'ev_883ac2a8a95464a7bfe5b751c3128c8f1f25c79b6c8b1db537f203bda6f500e6',
    operation: 'analyze_javascript_application',
    predicateType: 'rea.javascript-application-analysis',
    target: 'Next.js Marketing Artifact Container',
    sha256Digest: '783b33e3f4c5ac353a8d4e0d01cdfe6bf6b8431c4eb7e051447f413aa0ae56f1',
    summary:
      'Static AST analysis recovering 20 public routes (ev_871908480a0ee2374c585ffbaaa8050faab0e71ac8aa6f604d8cf4d15c92b0f2), pricing tiers, and calculator specifications.',
  },
  {
    evidenceId: 'ev_1e2972dbf12bab643311b13307a5db9d186625f557214f53e280dd6936473dd1',
    operation: 'capture_browser_scenario',
    predicateType: 'rea.browser-scenario-capture',
    target: 'https://taxone.vyapar.com/app/signIn (Authenticated CA SaaS SPA)',
    sha256Digest: '7dbeb51c43d7addd809fffc8bb2d537ae80eff8a06c5d8b7b060b1cb7381c309',
    summary:
      '64 MiB network-body scenario capture recovering the 20.04 MB production webpackChunksuvit_frontend bundle and 997 KB enterprise CSS.',
  },
  {
    evidenceId: 'ev_fa905b773e33ca4fc6f96ce1f2d94177cd607346fe243618e21f2aabbde17564',
    operation: 'export_web_scripts',
    predicateType: 'rea.web-script-export',
    target: '/app/static/js/main.060bc231.js (20,045,981 bytes)',
    sha256Digest: '9ec0d4795b749391801670a94672954f5332b036f2c28a47465ee6385e9e36b6',
    summary:
      'Lossless extraction of the complete monolithic React SPA bundle containing all 6 SaaS modules.',
  },
  {
    evidenceId: 'ev_e41ed5624ad396558d96b81d47852015bac6ebc34d4c12a9abb68a24f9e0a854',
    operation: 'analyze_javascript_application',
    predicateType: 'rea.javascript-application-analysis',
    target: 'Vyapar TaxOne Monolithic SPA Bundle',
    sha256Digest: '9ec0d4795b749391801670a94672954f5332b036f2c28a47465ee6385e9e36b6',
    summary:
      'Recovered 146 SPA routes, 50+ microservice endpoints, 848 UI strings, 256 GST validation checks, Chanakya AI CA GPT prompts, and Tally XML bridge contracts (Summary View ev_f09964bcd7b633a26e863fcb4daa6b6c27446db7151a70f81469bc94894c14f2).',
  },
];

export const DISCOVERED_MICROSERVICES = [
  { service: 'Auth & RBAC Gateway', upstreamPattern: 'api.taxone.vyapar.com/auth/v2/*', rebuiltEndpoint: '/api/auth/*' },
  { service: 'Company & Tally Connector Service', upstreamPattern: 'api.taxone.vyapar.com/company-service/*', rebuiltEndpoint: '/api/companies & /api/tally/*' },
  { service: 'Banking & Smart Rule Engine', upstreamPattern: 'api.taxone.vyapar.com/banking-automation/*', rebuiltEndpoint: '/api/banking/*' },
  { service: 'Bulk Sales / Purchase / OCR Service', upstreamPattern: 'api.taxone.vyapar.com/voucher-ocr-engine/*', rebuiltEndpoint: '/api/vouchers/*' },
  { service: 'Vyapar Billing Sync Bridge', upstreamPattern: 'api.taxone.vyapar.com/vyapar-sync/*', rebuiltEndpoint: '/api/vyapar/sync' },
  { service: 'GSTR-1/2A/2B/IMS Reconciliation Engine', upstreamPattern: 'gst.taxone.vyapar.com/reco/v3/*', rebuiltEndpoint: '/api/gst/reconcile & /api/gst/ims/*' },
  { service: '32-Rule Smart GST Validator', upstreamPattern: 'gst.taxone.vyapar.com/smart-validation/*', rebuiltEndpoint: '/api/gst/validations' },
  { service: 'GSTR-1 JSON & GSTR-3B Offset Service', upstreamPattern: 'gst.taxone.vyapar.com/return-filing/*', rebuiltEndpoint: '/api/gst/gstr1 & /api/gst/gstr3b' },
  { service: 'TaxOne WhatsApp Chat & Reminders', upstreamPattern: 'chat.taxone.vyapar.com/wa-inbox/*', rebuiltEndpoint: '/api/chat/*' },
  { service: 'PMS Practice Task Engine', upstreamPattern: 'pms.taxone.vyapar.com/tasks/*', rebuiltEndpoint: '/api/pms/tasks' },
  { service: 'TaxOne Drive Vault', upstreamPattern: 'drive.taxone.vyapar.com/documents/*', rebuiltEndpoint: '/api/drive/documents' },
  { service: 'Chanakya AI (CA GPT)', upstreamPattern: 'ai.taxone.vyapar.com/chanakya/chat', rebuiltEndpoint: '/api/chanakya/ask' },
];

export const HSN_DIRECTORY_2026 = [
  { code: '540247', description: 'High-tenacity polyester textured filament yarn', rate: 12, chapter: 'Chapter 54 — Man-Made Filaments' },
  { code: '540752', description: 'Woven fabrics of synthetic filament yarn, dyed', rate: 5, chapter: 'Chapter 54 — Man-Made Filaments' },
  { code: '847130', description: 'Portable automatic data processing machines (Laptops / Industrial HMI)', rate: 18, chapter: 'Chapter 84 — Machinery & Computers' },
  { code: '853710', description: 'PLC / Numerical control panels & servo boards <= 1,000V', rate: 18, chapter: 'Chapter 85 — Electrical Equipment' },
  { code: '853649', description: 'Industrial relays, contactors & circuit protection apparatus', rate: 18, chapter: 'Chapter 85 — Electrical Equipment' },
  { code: '320411', description: 'Disperse & reactive synthetic organic colouring dyes', rate: 18, chapter: 'Chapter 32 — Dyes & Pigments' },
  { code: '481910', description: 'Cartons, boxes and cases of corrugated paper or paperboard', rate: 18, chapter: 'Chapter 48 — Paper & Packaging' },
  { code: '998221', description: 'Financial auditing, GST return filing & tax consultancy services (SAC)', rate: 18, chapter: 'SAC 9982 — Accounting & Legal' },
  { code: '998314', description: 'IT software design, cloud SaaS & ERP customization services (SAC)', rate: 18, chapter: 'SAC 9983 — IT & Professional' },
  { code: '996511', description: 'Road transport services of goods by Goods Transport Agency (GTA RCM/FCM)', rate: 5, chapter: 'SAC 9965 — Goods Transport' },
  { code: '870323', description: 'Motor cars & passenger vehicles (Blocked ITC u/s 17(5) unless exempt)', rate: 28, chapter: 'Chapter 87 — Motor Vehicles' },
  { code: '040110', description: 'Fresh pasteurized liquid milk, uncondensed & unsweetened', rate: 0, chapter: 'Chapter 04 — Dairy Produce' },
];
