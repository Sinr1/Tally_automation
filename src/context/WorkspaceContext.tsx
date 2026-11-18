import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export interface CompanyInfo {
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
  books_source: string;
}

export interface AuthUser {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  firm_name: string;
  role: string;
}

export interface XmlModalPayload {
  title: string;
  filename: string;
  xml: string;
  subtitle?: string;
}

interface WorkspaceContextValue {
  user: AuthUser;
  setUser: (u: AuthUser) => void;
  companies: CompanyInfo[];
  activeCompany: CompanyInfo | null;
  activeCompanyId: number;
  setActiveCompanyId: (id: number) => void;
  refreshCompanies: () => Promise<void>;
  toast: string | null;
  showToast: (msg: string) => void;
  xmlModal: XmlModalPayload | null;
  setXmlModal: (payload: XmlModalPayload | null) => void;
}

const DEFAULT_USER: AuthUser = {
  id: 1,
  full_name: 'CA Siddharth Mehta',
  email: 'ca.siddharth@mehtadeshmukh.in',
  phone: '+91 98250 44190',
  firm_name: 'Mehta & Deshmukh Chartered Accountants',
  role: 'Admin',
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser>(() => {
    try {
      const saved = localStorage.getItem('taxone_user');
      return saved ? (JSON.parse(saved) as AuthUser) : DEFAULT_USER;
    } catch {
      return DEFAULT_USER;
    }
  });
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<number>(1);
  const [toast, setToast] = useState<string | null>(null);
  const [xmlModal, setXmlModal] = useState<XmlModalPayload | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3600);
  }, []);

  const refreshCompanies = useCallback(async () => {
    try {
      const res = await fetch('/api/companies');
      if (!res.ok) return;
      const data = (await res.json()) as { companies: CompanyInfo[] };
      setCompanies(data.companies || []);
      if (
        data.companies.length > 0 &&
        !data.companies.some((c) => c.id === activeCompanyId)
      ) {
        setActiveCompanyId(data.companies[0].id);
      }
    } catch {
      // ignore initial offline fetch
    }
  }, [activeCompanyId]);

  useEffect(() => {
    void refreshCompanies();
  }, [refreshCompanies]);

  const handleSetUser = useCallback((u: AuthUser) => {
    setUser(u);
    try {
      localStorage.setItem('taxone_user', JSON.stringify(u));
    } catch {
      // ignore storage quota
    }
  }, []);

  const activeCompany =
    companies.find((c) => c.id === activeCompanyId) || companies[0] || null;

  return (
    <WorkspaceContext.Provider
      value={{
        user,
        setUser: handleSetUser,
        companies,
        activeCompany,
        activeCompanyId,
        setActiveCompanyId,
        refreshCompanies,
        toast,
        showToast,
        xmlModal,
        setXmlModal,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used inside WorkspaceProvider');
  }
  return ctx;
}
