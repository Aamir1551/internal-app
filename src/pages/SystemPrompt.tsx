import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '@/lib/supabase';
import {
  getSystemPrompt,
  saveSystemPrompt,
  listDbTests,
  createDbTest,
  updateDbTest,
  upsertDbTest,
  deleteDbTest,
  type TestCaseDb,
  type TestMessage,
} from '@/lib/adminApi';
import { ALL_TESTS, categoryPill, type TestCase } from './Tests';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const CATEGORIES = [
  'food', 'prayer_times', 'wedding_halls', 'activities_clubs',
  'tradespeople', 'schools', 'events', 'jobs', 'interesting_facts', 'general',
];

// ── Types ─────────────────────────────────────────────────────────────────────

type TurnResult = {
  userMessage: string;
  goldResponse: string;
  agentResponse: string;
};

type TestRun = {
  status: 'running' | 'done' | 'error';
  currentTurn: number;
  turns: TurnResult[];
  error?: string;
};

// ── Chat streaming ────────────────────────────────────────────────────────────

async function streamChatTurn(
  history: { role: 'user' | 'assistant'; content: string }[],
  onChunk: (text: string) => void,
  userToken: string,
  signal: AbortSignal,
): Promise<string> {
  const res = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANON_KEY}`,
      'x-user-token': userToken,
    },
    body: JSON.stringify({ history }),
    signal,
  });

  if (!res.ok || !res.body) throw new Error(`Chat ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed);
          if (event.type === 'text') { fullText += event.data; onChunk(event.data); }
          if (event.type === 'error') throw new Error(event.message);
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  return fullText;
}

async function runTest(
  test: TestCase | TestCaseDb,
  userToken: string,
  onUpdate: (run: TestRun) => void,
  signal: AbortSignal,
): Promise<void> {
  const msgs = test.messages as TestMessage[];
  const pairs: { user: string; gold: string }[] = [];
  for (let i = 0; i + 1 < msgs.length; i++) {
    if (msgs[i].role === 'user' && msgs[i + 1].role === 'agent') {
      pairs.push({ user: msgs[i].content, gold: msgs[i + 1].content });
      i++;
    }
  }

  const turns: TurnResult[] = pairs.map((p) => ({ userMessage: p.user, goldResponse: p.gold, agentResponse: '' }));
  onUpdate({ status: 'running', currentTurn: 0, turns: [...turns] });

  const history: { role: 'user' | 'assistant'; content: string }[] = [];

  for (let i = 0; i < pairs.length; i++) {
    if (signal.aborted) break;
    history.push({ role: 'user', content: pairs[i].user });
    onUpdate({ status: 'running', currentTurn: i, turns: turns.map((t, ti) => ti === i ? { ...t, agentResponse: '' } : t) });

    await streamChatTurn(history, (chunk) => {
      turns[i] = { ...turns[i], agentResponse: turns[i].agentResponse + chunk };
      onUpdate({ status: 'running', currentTurn: i, turns: [...turns] });
    }, userToken, signal);

    history.push({ role: 'assistant', content: turns[i].agentResponse });
  }

  onUpdate({
    status: signal.aborted ? 'error' : 'done',
    currentTurn: -1,
    turns: [...turns],
    error: signal.aborted ? 'Stopped' : undefined,
  });
}

// ── Conversation thread (gold standard view) ──────────────────────────────────

function ConversationThread({ messages }: { messages: TestMessage[] }) {
  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <div style={{ paddingTop: '12px' }} />
      {messages.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {msg.role === 'user' ? (
            <div className="bubble-user">{msg.content}</div>
          ) : (
            <div className="bubble-assistant prose-chat">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Turn comparison (side-by-side) ────────────────────────────────────────────

function TurnComparison({ turn, streaming }: { turn: TurnResult; streaming: boolean }) {
  return (
    <div>
      {/* User message */}
      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <div className="bubble-user" style={{ maxWidth: '70%' }}>{turn.userMessage}</div>
      </div>

      {/* Side-by-side responses */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid var(--color-border)' }}>
        {/* Gold */}
        <div style={{ padding: '12px 16px', borderRight: '1px solid var(--color-border)' }}>
          <div className="label mb-2" style={{ color: 'var(--color-warning)' }}>Gold Standard</div>
          <div
            className="prose-chat"
            style={{
              fontSize: '0.875rem', lineHeight: '1.55',
              padding: '10px 12px', borderRadius: '8px',
              background: 'rgba(245,158,11,0.05)',
              border: '1px solid rgba(245,158,11,0.2)',
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.goldResponse}</ReactMarkdown>
          </div>
        </div>

        {/* Live Agent */}
        <div style={{ padding: '12px 16px' }}>
          <div className="label mb-2" style={{ color: streaming ? 'var(--color-accent)' : 'var(--color-muted)' }}>
            Live Agent{streaming && <span style={{ marginLeft: '6px', animation: 'pulse 1s infinite' }}>●</span>}
          </div>
          <div
            className="prose-chat"
            style={{
              fontSize: '0.875rem', lineHeight: '1.55',
              padding: '10px 12px', borderRadius: '8px',
              background: turn.agentResponse ? 'rgba(59,130,246,0.05)' : 'rgba(0,0,0,0.2)',
              border: `1px solid ${turn.agentResponse ? 'rgba(59,130,246,0.2)' : 'var(--color-border)'}`,
              minHeight: '48px',
              color: turn.agentResponse ? 'var(--color-foreground)' : 'var(--color-muted)',
            }}
          >
            {turn.agentResponse
              ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.agentResponse}</ReactMarkdown>
              : streaming
                ? <span style={{ fontStyle: 'italic' }}>Generating…</span>
                : <span style={{ fontStyle: 'italic' }}>Not run</span>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Test card ─────────────────────────────────────────────────────────────────

function TestCard({
  test, run, onRun, onEdit, onDelete,
}: {
  test: TestCase | TestCaseDb;
  run?: TestRun;
  onRun?: () => void;
  onEdit?: (updated: Pick<TestCaseDb, 'id' | 'category' | 'description' | 'messages'>) => Promise<void>;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const isDb = 'created_at' in test;

  useEffect(() => {
    if (run) setOpen(true);
  }, [!!run]);

  const statusBadge = run
    ? run.status === 'running'
      ? <span className="pill pill-warning" style={{ fontSize: '11px' }}>Running…</span>
      : run.status === 'done'
        ? <span className="pill pill-success" style={{ fontSize: '11px' }}>Done</span>
        : <span className="pill pill-danger" style={{ fontSize: '11px' }}>{run.error ?? 'Error'}</span>
    : null;

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => { if (!editing) setOpen((o) => !o); }}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        style={{ background: 'transparent', border: 'none', cursor: editing ? 'default' : 'pointer' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-xs shrink-0" style={{ color: 'var(--color-muted)' }}>
            {test.id.split('_')[0]}
          </span>
          {categoryPill(test.category)}
          <span className="text-sm truncate">{test.description}</span>
          {statusBadge}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {!editing && (
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
              {open ? '▲ hide' : '▼ show'}
            </span>
          )}
          {onRun && !editing && (
            <button
              onClick={(e) => { e.stopPropagation(); onRun(); }}
              className="btn"
              disabled={run?.status === 'running'}
              style={{ padding: '2px 8px', fontSize: '12px' }}
            >
              {run?.status === 'running' ? '…' : '▶ Run'}
            </button>
          )}
          {onEdit && !editing && (
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(true); setOpen(true); }}
              className="btn"
              style={{ padding: '2px 8px', fontSize: '12px' }}
            >
              Edit
            </button>
          )}
          {isDb && onDelete && !editing && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete!(); }}
              className="btn"
              style={{ color: 'var(--color-danger)', padding: '2px 8px', fontSize: '12px' }}
            >
              Delete
            </button>
          )}
        </div>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--color-border)' }}>
          {editing ? (
            <div style={{ padding: '16px' }}>
              <TestForm
                initialValues={{ id: test.id, category: test.category, description: test.description, messages: test.messages as TestMessage[] }}
                onSave={async (updated) => { await onEdit!(updated); setEditing(false); }}
                onCancel={() => setEditing(false)}
              />
            </div>
          ) : run ? (
            run.turns.length === 0 ? (
              <p style={{ padding: '16px', color: 'var(--color-muted)', fontSize: '0.875rem' }}>Starting…</p>
            ) : (
              run.turns.map((turn, i) => (
                <div key={i} style={{ borderTop: i > 0 ? '1px solid var(--color-border)' : undefined }}>
                  <TurnComparison
                    turn={turn}
                    streaming={run.status === 'running' && run.currentTurn === i}
                  />
                </div>
              ))
            )
          ) : (
            <ConversationThread messages={test.messages as TestMessage[]} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Test form (create + edit) ──────────────────────────────────────────────────

function TestForm({
  initialValues,
  onSave, onCancel,
}: {
  initialValues?: Pick<TestCaseDb, 'id' | 'category' | 'description' | 'messages'>;
  onSave: (test: Pick<TestCaseDb, 'id' | 'category' | 'description' | 'messages'>) => Promise<void>;
  onCancel: () => void;
}) {
  const isEdit = !!initialValues;
  const [category, setCategory] = useState(initialValues?.category ?? 'food');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [messages, setMessages] = useState<TestMessage[]>(
    initialValues?.messages && initialValues.messages.length >= 2
      ? initialValues.messages
      : [{ role: 'user', content: '' }, { role: 'agent', content: '' }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const addTurn = () => {
    const lastRole = messages[messages.length - 1]?.role ?? 'agent';
    const nextRole = lastRole === 'user' ? 'agent' : 'user';
    setMessages((prev) => [...prev, { role: nextRole, content: '' }]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const removeMessage = (i: number) => setMessages((prev) => prev.filter((_, idx) => idx !== i));

  const updateMessage = (i: number, field: 'role' | 'content', val: string) =>
    setMessages((prev) => prev.map((m, idx) => (idx === i ? { ...m, [field]: val } : m)));

  const handleSave = async () => {
    if (!description.trim()) { setError('Description is required.'); return; }
    const validMessages = messages.filter((m) => m.content.trim());
    if (validMessages.length < 2) { setError('Add at least 2 messages.'); return; }
    const id = initialValues?.id ?? `${Date.now()}_${category}`;
    setSaving(true); setError(null);
    try {
      await onSave({ id, category, description: description.trim(), messages: validMessages });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 className="text-base font-semibold">{isEdit ? 'Edit Test' : 'New Test'}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>Category</label>
          <select className="input text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>Description</label>
          <input
            className="input text-sm"
            placeholder="Short description of the scenario…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>Messages</label>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <select
              className="input text-xs shrink-0"
              style={{ width: '80px' }}
              value={msg.role}
              onChange={(e) => updateMessage(i, 'role', e.target.value)}
            >
              <option value="user">User</option>
              <option value="agent">Agent</option>
            </select>
            <textarea
              className="input text-sm flex-1"
              style={{ minHeight: '72px', resize: 'vertical' }}
              placeholder={msg.role === 'user' ? 'User message…' : 'Agent response…'}
              value={msg.content}
              onChange={(e) => updateMessage(i, 'content', e.target.value)}
            />
            {messages.length > 2 && (
              <button
                onClick={() => removeMessage(i)}
                className="btn shrink-0 text-xs"
                style={{ color: 'var(--color-danger)', marginTop: '2px' }}
              >✕</button>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
        <button className="btn text-sm" onClick={addTurn} style={{ alignSelf: 'flex-start' }}>+ Add turn</button>
      </div>
      {error && <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save test'}
        </button>
        <button className="btn" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </div>
  );
}

// ── Report generation ─────────────────────────────────────────────────────────

function generateReport(
  systemPrompt: string,
  allTests: (TestCase | TestCaseDb)[],
  runs: Record<string, TestRun>,
): string {
  const date = new Date().toISOString().slice(0, 10);
  const completedTests = allTests.filter((t) => runs[t.id]?.status === 'done' || runs[t.id]?.status === 'error');

  const lines: string[] = [
    `# BatleyGPT Agent Evaluation Report`,
    `Date: ${date}`,
    `Tests run: ${completedTests.length} / ${allTests.length}`,
    ``,
    `---`,
    ``,
    `## System Prompt`,
    ``,
    `\`\`\``,
    systemPrompt.trim(),
    `\`\`\``,
    ``,
    `---`,
    ``,
    `## Test Results`,
    ``,
  ];

  for (const test of completedTests) {
    const run = runs[test.id];
    const statusLabel = run.status === 'done' ? 'completed' : `error: ${run.error ?? 'unknown'}`;
    lines.push(`### ${test.id} — ${test.description}`);
    lines.push(`Category: ${test.category} | Status: ${statusLabel}`);
    lines.push(``);

    for (let i = 0; i < run.turns.length; i++) {
      const turn = run.turns[i];
      lines.push(`#### Turn ${i + 1}`);
      lines.push(``);
      lines.push(`**User:**`);
      lines.push(turn.userMessage);
      lines.push(``);
      lines.push(`**Gold Standard:**`);
      lines.push(turn.goldResponse);
      lines.push(``);
      lines.push(`**Live Agent:**`);
      lines.push(turn.agentResponse || '*(no response)*');
      lines.push(``);
    }

    lines.push(`---`);
    lines.push(``);
  }

  return lines.join('\n');
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function SystemPromptPage() {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [dbTests, setDbTests] = useState<TestCaseDb[]>([]);
  const [testsLoading, setTestsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [runs, setRuns] = useState<Record<string, TestRun>>({});
  const [runningAll, setRunningAll] = useState(false);
  const [runProgress, setRunProgress] = useState<{ done: number; total: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const userTokenRef = useRef<string | null>(null);

  useEffect(() => {
    getSystemPrompt()
      .then(({ prompt }) => { setValue(prompt); setSaved(prompt); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    listDbTests()
      .then(setDbTests)
      .catch(() => {})
      .finally(() => setTestsLoading(false));

    supabase.auth.getSession().then(({ data }) => {
      userTokenRef.current = data.session?.access_token ?? null;
    });
  }, []);

  const save = async () => {
    setSaving(true); setError(null); setSuccessMsg(null);
    try {
      await saveSystemPrompt(value);
      setSaved(value);
      setSuccessMsg('Saved — live for all users immediately.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTest = async (test: Pick<TestCaseDb, 'id' | 'category' | 'description' | 'messages'>) => {
    await createDbTest(test);
    setDbTests((prev) => [...prev, { ...test, created_at: new Date().toISOString() }]);
    setShowCreate(false);
  };

  const handleEditTest = async (updated: Pick<TestCaseDb, 'id' | 'category' | 'description' | 'messages'>) => {
    await updateDbTest(updated);
    setDbTests((prev) => prev.map((t) => t.id === updated.id ? { ...t, ...updated } : t));
  };

  const handleEditStaticTest = async (updated: Pick<TestCaseDb, 'id' | 'category' | 'description' | 'messages'>) => {
    await upsertDbTest(updated);
    setDbTests((prev) => {
      const exists = prev.some((t) => t.id === updated.id);
      if (exists) return prev.map((t) => t.id === updated.id ? { ...t, ...updated } : t);
      return [...prev, { ...updated, created_at: new Date().toISOString() }];
    });
  };

  const handleDeleteTest = async (id: string) => {
    await deleteDbTest(id);
    setDbTests((prev) => prev.filter((t) => t.id !== id));
  };

  const handleRunAll = async () => {
    const token = userTokenRef.current;
    if (!token) { alert('No user session — please reload.'); return; }

    const allTests: (TestCase | TestCaseDb)[] = [...ALL_TESTS, ...dbTests];
    const abort = new AbortController();
    abortRef.current = abort;

    setRunningAll(true);
    setRuns({});
    setRunProgress({ done: 0, total: allTests.length });

    for (let i = 0; i < allTests.length; i++) {
      if (abort.signal.aborted) break;
      const test = allTests[i];
      try {
        await runTest(
          test,
          token,
          (run) => setRuns((prev) => ({ ...prev, [test.id]: run })),
          abort.signal,
        );
      } catch (e) {
        if ((e as Error).name === 'AbortError') break;
        setRuns((prev) => ({
          ...prev,
          [test.id]: {
            status: 'error',
            currentTurn: -1,
            turns: prev[test.id]?.turns ?? [],
            error: e instanceof Error ? e.message : String(e),
          },
        }));
      }
      setRunProgress({ done: i + 1, total: allTests.length });
    }

    setRunningAll(false);
    abortRef.current = null;
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setRunningAll(false);
  };

  const handleRunOne = async (test: TestCase | TestCaseDb) => {
    const token = userTokenRef.current;
    if (!token) { alert('No user session — please reload.'); return; }
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      await runTest(
        test,
        token,
        (run) => setRuns((prev) => ({ ...prev, [test.id]: run })),
        abort.signal,
      );
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setRuns((prev) => ({
          ...prev,
          [test.id]: {
            status: 'error', currentTurn: -1,
            turns: prev[test.id]?.turns ?? [],
            error: e instanceof Error ? e.message : String(e),
          },
        }));
      }
    }
  };

  const isDirty = value !== saved;
  const dbTestIds = new Set(dbTests.map((t) => t.id));
  const allTests: (TestCase | TestCaseDb)[] = [
    ...ALL_TESTS.filter((t) => !dbTestIds.has(t.id)),
    ...dbTests,
  ];

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">System Prompt</h1>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Live system prompt sent to the AI on every chat request. Changes take effect immediately — no redeployment needed.
        </p>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</p>
      ) : (
        <div className="space-y-4">
          <textarea
            className="input w-full font-mono text-sm"
            style={{ minHeight: '60vh', resize: 'vertical' }}
            value={value}
            onChange={(e) => { setValue(e.target.value); setSuccessMsg(null); }}
            spellCheck={false}
          />
          <div className="flex items-center gap-3">
            <button className="btn btn-primary" onClick={save} disabled={saving || !isDirty}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            {isDirty && <span className="text-sm" style={{ color: 'var(--color-muted)' }}>Unsaved changes</span>}
            {successMsg && <span className="text-sm" style={{ color: 'var(--color-success)' }}>{successMsg}</span>}
            {error && <span className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</span>}
          </div>

          {/* ── Gold Standard Scenarios ── */}
          <div style={{ paddingTop: '32px' }}>
            {/* Section header */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold mb-1">Gold Standard Scenarios</h2>
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                  Run all tests to see how your current prompt performs against the ideal conversations.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  className="btn"
                  onClick={() => setShowCreate((v) => !v)}
                >
                  {showCreate ? '✕ Cancel' : '+ New test'}
                </button>
                {(() => {
                  const hasResults = Object.values(runs).some((r) => r.status === 'done' || r.status === 'error');
                  const stillRunning = runningAll || Object.values(runs).some((r) => r.status === 'running');
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                      <button
                        className="btn"
                        disabled={!hasResults || stillRunning}
                        onClick={() => {
                          const report = generateReport(value, allTests, runs);
                          const date = new Date().toISOString().slice(0, 10);
                          downloadText(`batleygpt-eval-${date}.md`, report);
                        }}
                      >
                        ↓ Download Report
                      </button>
                      {(!hasResults || stillRunning) && (
                        <span style={{ fontSize: '10px', color: 'var(--color-muted)' }}>
                          {stillRunning ? 'Wait for runs to finish' : 'Run tests first'}
                        </span>
                      )}
                    </div>
                  );
                })()}
                {runningAll ? (
                  <button className="btn btn-danger" onClick={handleStop}>
                    ■ Stop
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={handleRunAll}
                    disabled={allTests.length === 0}
                  >
                    ▶ Run All
                  </button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {runProgress && (
              <div
                className="card"
                style={{
                  padding: '12px 16px', marginBottom: '16px',
                  display: 'flex', alignItems: 'center', gap: '12px',
                }}
              >
                <div style={{ flex: 1, background: 'var(--color-border)', borderRadius: '9999px', height: '6px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%', borderRadius: '9999px',
                      background: runningAll ? 'var(--color-accent)' : 'var(--color-success)',
                      width: `${(runProgress.done / runProgress.total) * 100}%`,
                      transition: 'width 300ms ease',
                    }}
                  />
                </div>
                <span className="text-sm shrink-0" style={{ color: 'var(--color-muted)', minWidth: '80px', textAlign: 'right' }}>
                  {runningAll
                    ? `Running ${runProgress.done + 1} / ${runProgress.total}`
                    : `${runProgress.done} / ${runProgress.total} done`}
                </span>
              </div>
            )}

            {showCreate && (
              <div style={{ marginBottom: '12px' }}>
                <TestForm onSave={handleCreateTest} onCancel={() => setShowCreate(false)} />
              </div>
            )}

            <div className="space-y-3">
              {allTests.map((t) => (
                <TestCard
                  key={t.id}
                  test={t}
                  run={runs[t.id]}
                  onRun={() => handleRunOne(t)}
                  onEdit={'created_at' in t ? handleEditTest : handleEditStaticTest}
                  onDelete={'created_at' in t ? () => handleDeleteTest(t.id) : undefined}
                />
              ))}
              {testsLoading && (
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Loading custom tests…</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
