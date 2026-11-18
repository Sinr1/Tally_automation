import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { WorkspaceProvider } from './context/WorkspaceContext.tsx';
import { CalculatorsPage } from './pages/CalculatorsPage.tsx';
import {
  BankRulesPage,
  BankingAutomationPage,
  ManualCloudVouchersPage,
  MastersManagementPage,
  SalesPurchaseWorkbenchPage,
  VyaparSyncPage,
} from './pages/DataAutomationPages.tsx';
import {
  GstDashboardPage,
  GstNoticesPage,
  GstReconcileImsPage,
  Gstr1FilingPage,
  Gstr3bFilingPage,
  SmartGstValidationsPage,
} from './pages/GstAutomationPages.tsx';
import {
  ActivityLogsPage,
  ClientsDirectoryPage,
  PracticeDashboardPage,
  SubscribedCompaniesPage,
  UsersRbacPage,
} from './pages/HomeModulePages.tsx';
import {
  ChanakyaAiPage,
  PmsTasksPage,
  ReaProvenancePage,
  TaxOneChatPage,
  TaxOneDrivePage,
} from './pages/PracticeCollabPages.tsx';
import {
  AuthPage,
  ContactPage,
  FeaturePage,
  HomePage,
  PricingPage,
} from './pages/PublicPages.tsx';

export default function App() {
  return (
    <WorkspaceProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Next.js Marketing & Statutory Toolkit Routes */}
          <Route path="/" element={<HomePage />} />
          <Route
            path="/data-entry-automation-feature"
            element={<FeaturePage variant="data-entry" />}
          />
          <Route
            path="/gst-reconciliation-feature"
            element={<FeaturePage variant="gst-reco" />}
          />
          <Route path="/taxone-chat" element={<FeaturePage variant="chat" />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/calculators" element={<CalculatorsPage />} />
          <Route path="/contact-us" element={<ContactPage />} />
          <Route path="/about" element={<ContactPage />} />

          {/* Authentication Routes */}
          <Route path="/app/signIn" element={<AuthPage mode="signIn" />} />
          <Route path="/app/signUp" element={<AuthPage mode="signUp" />} />
          <Route path="/signIn" element={<Navigate to="/app/signIn" replace />} />
          <Route path="/signUp" element={<Navigate to="/app/signUp" replace />} />

          {/* Module 1: Practice Home & Admin (/app/home/*) */}
          <Route path="/app" element={<Navigate to="/app/home/dashboard" replace />} />
          <Route path="/app/home/dashboard" element={<PracticeDashboardPage />} />
          <Route path="/app/home/company" element={<SubscribedCompaniesPage />} />
          <Route path="/app/home/gst-manager" element={<SubscribedCompaniesPage />} />
          <Route path="/app/home/clients" element={<ClientsDirectoryPage />} />
          <Route path="/app/home/users" element={<UsersRbacPage />} />
          <Route path="/app/home/role-permissions" element={<UsersRbacPage />} />
          <Route path="/app/activity-log" element={<ActivityLogsPage />} />

          {/* Module 2: Data Entry Automation (/app/da/*) */}
          <Route path="/app/da" element={<Navigate to="/app/da/banking" replace />} />
          <Route path="/app/da/dashboard" element={<PracticeDashboardPage />} />
          <Route path="/app/da/banking" element={<BankingAutomationPage />} />
          <Route path="/app/da/banking/*" element={<BankingAutomationPage />} />
          <Route path="/app/da/rulelist" element={<BankRulesPage />} />
          <Route path="/app/da/sales" element={<SalesPurchaseWorkbenchPage mode="Sales" />} />
          <Route path="/app/da/sales/*" element={<SalesPurchaseWorkbenchPage mode="Sales" />} />
          <Route
            path="/app/da/purchase"
            element={<SalesPurchaseWorkbenchPage mode="Purchase" />}
          />
          <Route
            path="/app/da/purchase/*"
            element={<SalesPurchaseWorkbenchPage mode="Purchase" />}
          />
          <Route path="/app/da/journal/*" element={<ManualCloudVouchersPage />} />
          <Route path="/app/da/add-vouchers" element={<ManualCloudVouchersPage />} />
          <Route path="/app/da/add-vouchers/*" element={<ManualCloudVouchersPage />} />
          <Route path="/app/da/ledger-master" element={<MastersManagementPage />} />
          <Route path="/app/da/item-master" element={<MastersManagementPage />} />
          <Route path="/app/da/vyapar" element={<VyaparSyncPage />} />
          <Route path="/app/da/vyapar-mapping" element={<VyaparSyncPage />} />

          {/* Module 3: GST Automation & IMS (/app/ga/*) */}
          <Route path="/app/ga" element={<Navigate to="/app/ga/dashboard" replace />} />
          <Route path="/app/ga/dashboard" element={<GstDashboardPage />} />
          <Route path="/app/ga/summary" element={<GstDashboardPage />} />
          <Route path="/app/ga/audit/reviewAndFix" element={<SmartGstValidationsPage />} />
          <Route
            path="/app/ga/audit/ims"
            element={<GstReconcileImsPage defaultReturn="GSTR-2B" />}
          />
          <Route
            path="/app/ga/audit/gstr2b"
            element={<GstReconcileImsPage defaultReturn="GSTR-2B" />}
          />
          <Route
            path="/app/ga/audit/gstr2a"
            element={<GstReconcileImsPage defaultReturn="GSTR-2A" />}
          />
          <Route
            path="/app/ga/audit/gstr1"
            element={<GstReconcileImsPage defaultReturn="GSTR-1" />}
          />
          <Route path="/app/ga/return-filing" element={<Gstr1FilingPage />} />
          <Route path="/app/ga/gstr3b-filing" element={<Gstr3bFilingPage />} />
          <Route path="/app/ga/notice-order" element={<GstNoticesPage />} />

          {/* Modules 4–6: Chat, PMS, Drive, Chanakya AI & REA Provenance */}
          <Route path="/app/chat" element={<TaxOneChatPage />} />
          <Route path="/app/chat/*" element={<TaxOneChatPage />} />
          <Route path="/app/pms" element={<PmsTasksPage />} />
          <Route path="/app/pms/*" element={<PmsTasksPage />} />
          <Route path="/app/drive" element={<TaxOneDrivePage />} />
          <Route path="/app/drive/*" element={<TaxOneDrivePage />} />
          <Route path="/app/chanakya-ai" element={<ChanakyaAiPage />} />
          <Route path="/app/rea-evidence" element={<ReaProvenancePage />} />

          {/* Direct bare-path SPA aliases matching internal React Router paths */}
          <Route path="/home/*" element={<Navigate to="/app/home/dashboard" replace />} />
          <Route path="/da/*" element={<Navigate to="/app/da/banking" replace />} />
          <Route path="/ga/*" element={<Navigate to="/app/ga/dashboard" replace />} />
          <Route path="/pms/*" element={<Navigate to="/app/pms" replace />} />
          <Route path="/drive/*" element={<Navigate to="/app/drive" replace />} />
          <Route path="/chanakya-ai" element={<Navigate to="/app/chanakya-ai" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </WorkspaceProvider>
  );
}
