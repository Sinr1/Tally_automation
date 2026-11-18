import {
  Bot,
  Forward,
  Paperclip,
  Plus,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { WorkspaceLayout } from '../components/WorkspaceLayout.tsx';
import { useWorkspace } from '../context/WorkspaceContext.tsx';
import { DISCOVERED_MICROSERVICES, REA_EVIDENCE_CHAIN } from '../data/reaEvidence.ts';

interface ChatThread {
  id: number;
  company_id: number;
  client_name: string;
  whatsapp_number: string;
  assigned_member: string;
  unread_count: number;
  last_message: string;
  last_timestamp: string;
}

interface ChatMsg {
  id: number;
  sender_type: 'firm' | 'client';
  sender_name: string;
  body: string;
  attachment_name: string;
  forwarded_module: string;
  sent_at: string;
}

export function TaxOneChatPage() {
  const { user, activeCompanyId, showToast } = useWorkspace();
  const [tab, setTab] = useState<'inbox' | 'reminders'>('inbox');
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<number>(1);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [reminders, setReminders] = useState<
    {
      id: number;
      template_title: string;
      channel: string;
      frequency: string;
      next_run_date: string;
      status: string;
    }[]
  >([]);
  const [templates, setTemplates] = useState<
    { id: number; title: string; category: string; body_template: string }[]
  >([]);

  const loadThreads = useCallback(async () => {
    const res = await fetch('/api/chat/threads');
    if (res.ok) {
      const d = (await res.json()) as { threads: ChatThread[] };
      setThreads(d.threads);
    }
  }, []);

  const loadMessages = useCallback(async (tid: number) => {
    const res = await fetch(`/api/chat/threads/${tid}/messages`);
    if (res.ok) {
      const d = (await res.json()) as { messages: ChatMsg[] };
      setMessages(d.messages);
    }
  }, []);

  const loadReminders = useCallback(async () => {
    const res = await fetch('/api/chat/reminders');
    if (res.ok) {
      const d = (await res.json()) as {
        reminders: typeof reminders;
        templates: typeof templates;
      };
      setReminders(d.reminders);
      setTemplates(d.templates);
    }
  }, []);

  useEffect(() => {
    void loadThreads();
    void loadReminders();
  }, [loadThreads, loadReminders]);

  useEffect(() => {
    void loadMessages(activeThreadId);
  }, [activeThreadId, loadMessages]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const res = await fetch(`/api/chat/threads/${activeThreadId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_name: `${user.full_name} (${user.role})`,
        body: draft,
      }),
    });
    if (res.ok) {
      setDraft('');
      void loadMessages(activeThreadId);
      void loadThreads();
    }
  };

  const handleForwardAttachment = async (messageId: number, targetModule: string) => {
    const res = await fetch('/api/chat/forward-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, targetModule, companyId: activeCompanyId }),
    });
    if (res.ok) {
      showToast(`Forwarded WhatsApp client file straight to ${targetModule}!`);
      void loadMessages(activeThreadId);
    }
  };

  const handleScheduleTemplate = async (title: string) => {
    const res = await fetch('/api/chat/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: activeCompanyId,
        template_title: title,
        channel: 'WhatsApp + Email',
        frequency: 'Monthly Automated',
        next_run_date: '2025-11-05',
      }),
    });
    if (res.ok) {
      showToast(`Scheduled automated WhatsApp reminder: "${title}"`);
      void loadReminders();
    }
  };

  return (
    <WorkspaceLayout>
      <div className="ws-page-header">
        <div>
          <h1 className="ws-page-title">Vyapar TaxOne Chat — Unified WhatsApp Client Inbox</h1>
          <p className="ws-page-sub">
            Collect client bank statements &amp; bills on WhatsApp, route attachments in 1 click, and automate GST follow-ups.
          </p>
        </div>

        <div className="sub-tabs">
          <button
            type="button"
            className={`sub-tab ${tab === 'inbox' ? 'active' : ''}`}
            onClick={() => setTab('inbox')}
          >
            WhatsApp Client Inbox
          </button>
          <button
            type="button"
            className={`sub-tab ${tab === 'reminders' ? 'active' : ''}`}
            onClick={() => setTab('reminders')}
          >
            Automated Reminders &amp; Templates ({reminders.length})
          </button>
        </div>
      </div>

      {tab === 'inbox' ? (
        <div className="chat-layout">
          <div className="chat-thread-list">
            {threads.map((t) => (
              <div
                key={t.id}
                className={`chat-thread-item ${t.id === activeThreadId ? 'active' : ''}`}
                onClick={() => setActiveThreadId(t.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>{t.client_name}</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{t.last_timestamp}</span>
                </div>
                <div className="mono" style={{ fontSize: '11.5px', color: '#475569' }}>
                  {t.whatsapp_number} · Desk: {t.assigned_member}
                </div>
                <div
                  style={{
                    fontSize: '12.5px',
                    color: '#334155',
                    marginTop: '4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {t.last_message}
                </div>
              </div>
            ))}
          </div>

          <div className="chat-pane">
            <div className="chat-messages">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`chat-bubble ${m.sender_type === 'firm' ? 'firm' : ''}`}
                >
                  <div
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: '#475569',
                      marginBottom: '4px',
                    }}
                  >
                    {m.sender_name} · {m.sent_at}
                  </div>
                  <div>{m.body}</div>

                  {m.attachment_name ? (
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '8px 10px',
                        background: '#f8fafc',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span className="mono">
                        <Paperclip size={13} style={{ verticalAlign: 'middle' }} />{' '}
                        {m.attachment_name}
                      </span>

                      {m.forwarded_module ? (
                        <span className="badge badge-ok">
                          Routed → {m.forwarded_module}
                        </span>
                      ) : (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {['Banking', 'Purchase', 'Sales', 'Drive'].map((mod) => (
                            <button
                              key={mod}
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => void handleForwardAttachment(m.id, mod)}
                            >
                              <Forward size={11} /> {mod}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <form className="chat-composer" onSubmit={(e) => void handleSend(e)}>
              <input
                className="input"
                style={{ flex: 1 }}
                placeholder="Send WhatsApp message or document checklist to client..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="submit" className="btn btn-cobalt">
                <Send size={14} /> Send WhatsApp
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="split-two">
          <div className="ws-card">
            <div className="ws-card-head">
              <h3>Pre-Built CA WhatsApp Templates</h3>
            </div>
            <div className="ws-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  style={{
                    padding: '12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>{tpl.title}</div>
                  <p style={{ fontSize: '12.5px', color: '#475569', margin: '0 0 10px' }}>
                    {tpl.body_template}
                  </p>
                  <button
                    type="button"
                    className="btn btn-cobalt btn-sm"
                    onClick={() => void handleScheduleTemplate(tpl.title)}
                  >
                    Schedule Monthly Reminder
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="ws-card">
            <div className="ws-card-head">
              <h3>Active Scheduled Reminders</h3>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Channel</th>
                    <th>Next Run</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reminders.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.template_title}</td>
                      <td>{r.channel}</td>
                      <td className="mono">{r.next_run_date}</td>
                      <td>
                        <span className="badge badge-ok">{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </WorkspaceLayout>
  );
}

export function PmsTasksPage() {
  const { activeCompanyId, showToast } = useWorkspace();
  const [tasks, setTasks] = useState<
    {
      id: number;
      title: string;
      task_category: string;
      assignee: string;
      priority: string;
      status: string;
      due_date: string;
      linked_module: string;
    }[]
  >([]);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('Neha Kulkarni');
  const [priority, setPriority] = useState('High');

  const loadTasks = useCallback(async () => {
    const res = await fetch(`/api/pms/tasks?companyId=${activeCompanyId}`);
    if (res.ok) {
      const d = (await res.json()) as { tasks: typeof tasks };
      setTasks(d.tasks);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const handleAddTask = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/pms/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: activeCompanyId,
        title,
        assignee,
        priority,
        task_category: 'GST Filing',
        due_date: '2025-11-11',
      }),
    });
    if (res.ok) {
      setTitle('');
      showToast('Created PMS practice task');
      void loadTasks();
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    await fetch(`/api/pms/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    void loadTasks();
  };

  return (
    <WorkspaceLayout>
      <div className="ws-page-header">
        <div>
          <h1 className="ws-page-title">Practice Management System (PMS) — Compliance Tasks</h1>
          <p className="ws-page-sub">
            Assign GSTR-1/3B filing, banking knock-offs, and statutory audit deliverables across staff.
          </p>
        </div>
      </div>

      <div className="ws-card">
        <div className="ws-card-body">
          <form onSubmit={(e) => void handleAddTask(e)} className="form-grid">
            <div className="field">
              <label>Task Title</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Verify October GSTR-2B IMS Pending Bills"
              />
            </div>
            <div className="field">
              <label>Assignee</label>
              <select
                className="select"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
              >
                <option value="Neha Kulkarni">Neha Kulkarni (GST Desk)</option>
                <option value="Rohan Prajapati">Rohan Prajapati (Audit Head)</option>
                <option value="Ananya Iyer">Ananya Iyer (Article Assistant)</option>
                <option value="CA Siddharth Mehta">CA Siddharth Mehta (Partner)</option>
              </select>
            </div>
            <div className="field">
              <label>Priority</label>
              <select
                className="select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {['Urgent', 'High', 'Medium'].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-cobalt">
                <Plus size={14} /> Add PMS Task
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
                <th>Task</th>
                <th>Category</th>
                <th>Assigned Staff</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Workflow Stage</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 700 }}>{t.title}</td>
                  <td>
                    <span className="badge badge-neutral">{t.task_category}</span>
                  </td>
                  <td>{t.assignee}</td>
                  <td>
                    <span
                      className={`badge ${
                        t.priority === 'Urgent' ? 'badge-err' : 'badge-info'
                      }`}
                    >
                      {t.priority}
                    </span>
                  </td>
                  <td className="mono">{t.due_date}</td>
                  <td>
                    <select
                      className="inline-select"
                      value={t.status}
                      onChange={(e) => void handleStatusChange(t.id, e.target.value)}
                    >
                      <option value="Todo">Todo</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
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

export function TaxOneDrivePage() {
  const { activeCompanyId, showToast } = useWorkspace();
  const [docs, setDocs] = useState<
    {
      id: number;
      file_name: string;
      folder_category: string;
      file_size: string;
      uploaded_by: string;
      uploaded_at: string;
      transfer_status: string;
    }[]
  >([]);
  const [fileName, setFileName] = useState('');
  const [folder, setFolder] = useState('GST Returns & JSON');

  const loadDocs = useCallback(async () => {
    const res = await fetch(`/api/drive/documents?companyId=${activeCompanyId}`);
    if (res.ok) {
      const d = (await res.json()) as { documents: typeof docs };
      setDocs(d.documents);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);

  const handleUploadMeta = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/drive/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: activeCompanyId,
        file_name: fileName,
        folder_category: folder,
      }),
    });
    if (res.ok) {
      setFileName('');
      showToast('Archived document in Vyapar TaxOne Drive');
      void loadDocs();
    }
  };

  const handleTransferDecision = async (id: number, decision: string) => {
    await fetch(`/api/drive/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transfer_status: decision }),
    });
    showToast(`Document transfer marked ${decision}`);
    void loadDocs();
  };

  return (
    <WorkspaceLayout>
      <div className="ws-page-header">
        <div>
          <h1 className="ws-page-title">Vyapar TaxOne Drive — Client Document Vault</h1>
          <p className="ws-page-sub">
            Centralized statutory repository for bank statements, GSTR JSONs, Form 3CD audit reports, and client transfers.
          </p>
        </div>
      </div>

      <div className="ws-card">
        <div className="ws-card-body">
          <form onSubmit={(e) => void handleUploadMeta(e)} className="form-grid">
            <div className="field">
              <label>Document Filename</label>
              <input
                className="input"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                required
                placeholder="GSTR9C_Reconciliation_FY24-25.pdf"
              />
            </div>
            <div className="field">
              <label>Vault Folder</label>
              <select className="select" value={folder} onChange={(e) => setFolder(e.target.value)}>
                <option value="Bank Statements">Bank Statements</option>
                <option value="GST Returns & JSON">GST Returns &amp; JSON</option>
                <option value="Purchase Invoices">Purchase Invoices</option>
                <option value="Statutory Audit Vault">Statutory Audit Vault</option>
              </select>
            </div>
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-cobalt">
                Archive to Drive
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
                <th>File Name</th>
                <th>Vault Folder</th>
                <th>Size</th>
                <th>Source / Uploaded By</th>
                <th>Date</th>
                <th>Transfer Approval</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id}>
                  <td className="mono" style={{ fontWeight: 700 }}>
                    {doc.file_name}
                  </td>
                  <td>
                    <span className="badge badge-info">{doc.folder_category}</span>
                  </td>
                  <td className="mono">{doc.file_size}</td>
                  <td>{doc.uploaded_by}</td>
                  <td className="mono">{doc.uploaded_at}</td>
                  <td>
                    {doc.transfer_status === 'Pending Approval' ? (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          onClick={() => void handleTransferDecision(doc.id, 'Accepted')}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger-outline btn-sm"
                          onClick={() => void handleTransferDecision(doc.id, 'Rejected')}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="badge badge-ok">{doc.transfer_status}</span>
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

export function ChanakyaAiPage() {
  const { activeCompany, activeCompanyId } = useWorkspace();
  const [prompt, setPrompt] = useState('');
  const [reply, setReply] = useState<{
    answerMarkdown: string;
    citations: string[];
    liveMetricsUsed: Record<string, string | number>;
    suggestedActions: { label: string; route: string }[];
  } | null>(null);

  const askQuestion = useCallback(
    async (q: string) => {
      const res = await fetch('/api/chanakya/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: activeCompanyId, prompt: q }),
      });
      if (res.ok) {
        setReply(await res.json());
      }
    },
    [activeCompanyId]
  );

  useEffect(() => {
    void askQuestion('Executive compliance summary');
  }, [askQuestion]);

  return (
    <WorkspaceLayout>
      <div className="ws-page-header">
        <div>
          <h1 className="ws-page-title">
            <Bot size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
            Chanakya AI (CA GPT) — Live Books &amp; Statutory Tax Co-Pilot
          </h1>
          <p className="ws-page-sub">
            Grounded directly on <strong>{activeCompany?.name}</strong> SQLite ledgers, GSTR-2B/IMS feed, and Indian GST &amp; Income Tax statutes.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        {[
          ['Executive Health Brief', 'Executive compliance summary'],
          ['GSTR-2B & IMS Risk Audit', 'Explain GSTR-2B and IMS ITC position'],
          ['GSTR-3B Rule 88A Cash Offset', 'Compute GSTR-3B offset and cash challan'],
          ['Sec 43B(h) MSME 45-Day Check', 'Check Section 43B(h) MSME compliance'],
          ['Banking Duplicate & Tally Sync', 'Check banking duplicate rows and Tally sync'],
        ].map(([label, q]) => (
          <button
            key={label}
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void askQuestion(q)}
          >
            {label}
          </button>
        ))}
      </div>

      {reply && (
        <div className="ws-card">
          <div className="ws-card-head">
            <h3>Chanakya AI Analysis</h3>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {Object.entries(reply.liveMetricsUsed).map(([k, v]) => (
                <span key={k} className="badge badge-info">
                  {k}: {v}
                </span>
              ))}
            </div>
          </div>

          <div className="ws-card-body">
            <div
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.65,
                fontSize: '13.5px',
                color: '#0f172a',
              }}
            >
              {reply.answerMarkdown}
            </div>

            {reply.citations.length > 0 && (
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  STATUTORY REFERENCES:
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {reply.citations.map((c) => (
                    <span key={c} className="badge badge-neutral">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {reply.suggestedActions.length > 0 && (
              <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {reply.suggestedActions.map((act) => (
                  <Link key={act.route} to={act.route} className="btn btn-cobalt btn-sm">
                    {act.label} →
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="ws-card">
        <div className="ws-card-body">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!prompt.trim()) return;
              void askQuestion(prompt);
              setPrompt('');
            }}
            style={{ display: 'flex', gap: '10px' }}
          >
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="Ask Chanakya AI about GSTR-2B IMS, Rule 88A offset, Section 43B(h) MSME, or Banking rules..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <button type="submit" className="btn btn-cobalt">
              Ask Chanakya AI
            </button>
          </form>
        </div>
      </div>
    </WorkspaceLayout>
  );
}

export function ReaProvenancePage() {
  return (
    <WorkspaceLayout>
      <div className="ws-page-header">
        <div>
          <h1 className="ws-page-title">
            <ShieldCheck size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
            morluto/rea Reverse-Engineering Provenance &amp; Evidence Chain
          </h1>
          <p className="ws-page-sub">
            Cryptographic Evidence IDs and SHA-256 artifact digests captured from{' '}
            <span className="mono">https://taxone.vyapar.com/</span> and{' '}
            <span className="mono">/app/static/js/main.060bc231.js</span> via{' '}
            <span className="mono">rea-agents v6.9.0</span>.
          </p>
        </div>
      </div>

      <div className="ws-card">
        <div className="ws-card-head">
          <h3>Cryptographic REA Evidence Chain</h3>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>REA Evidence ID</th>
                <th>Operation</th>
                <th>Target Artifact</th>
                <th>Subject SHA-256 Digest</th>
                <th>Recovered Intelligence</th>
              </tr>
            </thead>
            <tbody>
              {REA_EVIDENCE_CHAIN.map((ev) => (
                <tr key={ev.evidenceId}>
                  <td className="mono" style={{ fontSize: '11.5px', fontWeight: 600 }}>
                    {ev.evidenceId.slice(0, 22)}…
                  </td>
                  <td>
                    <span className="badge badge-info">{ev.operation}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{ev.target}</td>
                  <td className="mono" style={{ fontSize: '11.5px' }}>
                    {ev.sha256Digest.slice(0, 18)}…
                  </td>
                  <td>{ev.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ws-card">
        <div className="ws-card-head">
          <h3>Reconstructed Upstream Microservices → Local Full-Stack SQLite API</h3>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Domain Subsystem</th>
                <th>Upstream Discovered Pattern</th>
                <th>Rebuilt Express + node:sqlite Endpoint</th>
              </tr>
            </thead>
            <tbody>
              {DISCOVERED_MICROSERVICES.map((ms) => (
                <tr key={ms.service}>
                  <td style={{ fontWeight: 700 }}>{ms.service}</td>
                  <td className="mono">{ms.upstreamPattern}</td>
                  <td className="mono" style={{ color: '#1a48d3', fontWeight: 600 }}>
                    {ms.rebuiltEndpoint}
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
