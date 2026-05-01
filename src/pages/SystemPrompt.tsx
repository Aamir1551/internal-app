import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  getSystemPrompt,
  saveSystemPrompt,
  listDbTests,
  createDbTest,
  deleteDbTest,
  type TestCaseDb,
  type TestMessage,
} from '@/lib/adminApi';
import { ALL_TESTS, categoryPill, type TestCase } from './Tests';

const CATEGORIES = [
  'food',
  'prayer_times',
  'wedding_halls',
  'activities_clubs',
  'tradespeople',
  'schools',
  'events',
  'jobs',
  'interesting_facts',
  'general',
];

// ── Shared conversation renderer ──────────────────────────────────────────────

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

// ── Single collapsible test card ──────────────────────────────────────────────

function TestCard({
  test,
  onDelete,
}: {
  test: TestCase | TestCaseDb;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isDb = 'created_at' in test;

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-xs shrink-0" style={{ color: 'var(--color-muted)' }}>
            {test.id.split('_')[0]}
          </span>
          {categoryPill(test.category)}
          <span className="text-sm truncate">{test.description}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
            {open ? '▲ hide' : '▼ show'}
          </span>
          {isDb && onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
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
          <ConversationThread messages={test.messages as TestMessage[]} />
        </div>
      )}
    </div>
  );
}

// ── Create test form ──────────────────────────────────────────────────────────

function CreateTestForm({
  onSave,
  onCancel,
}: {
  onSave: (test: Pick<TestCaseDb, 'id' | 'category' | 'description' | 'messages'>) => Promise<void>;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState('food');
  const [description, setDescription] = useState('');
  const [messages, setMessages] = useState<TestMessage[]>([
    { role: 'user', content: '' },
    { role: 'agent', content: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const addTurn = () => {
    const lastRole = messages[messages.length - 1]?.role ?? 'agent';
    const nextRole = lastRole === 'user' ? 'agent' : 'user';
    setMessages((prev) => [...prev, { role: nextRole, content: '' }]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const removeMessage = (i: number) => {
    setMessages((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateMessage = (i: number, field: 'role' | 'content', val: string) => {
    setMessages((prev) => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m));
  };

  const handleSave = async () => {
    if (!description.trim()) { setError('Description is required.'); return; }
    const validMessages = messages.filter((m) => m.content.trim());
    if (validMessages.length < 2) { setError('Add at least 2 messages.'); return; }

    const id = `${Date.now()}_${category}`;
    setSaving(true);
    setError(null);
    try {
      await onSave({ id, category, description: description.trim(), messages: validMessages });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 className="text-base font-semibold">New Test</h3>

      {/* Category + Description */}
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>Category</label>
          <select
            className="input text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
            ))}
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

      {/* Messages */}
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
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
        <button className="btn text-sm" onClick={addTurn} style={{ alignSelf: 'flex-start' }}>
          + Add turn
        </button>
      </div>

      {error && <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save test'}
        </button>
        <button className="btn" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function SystemPromptPage() {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState('');
  const [source, setSource] = useState<'db' | 'compiled' | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [dbTests, setDbTests] = useState<TestCaseDb[]>([]);
  const [testsLoading, setTestsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    getSystemPrompt()
      .then(({ prompt, source }) => { setValue(prompt); setSaved(prompt); setSource(source); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    listDbTests()
      .then(setDbTests)
      .catch(() => {})
      .finally(() => setTestsLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setError(null); setSuccessMsg(null);
    try {
      await saveSystemPrompt(value);
      setSaved(value); setSource('db');
      setSuccessMsg('Saved — live for all users immediately.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTest = async (
    test: Pick<TestCaseDb, 'id' | 'category' | 'description' | 'messages'>,
  ) => {
    await createDbTest(test);
    setDbTests((prev) => [...prev, { ...test, created_at: new Date().toISOString() }]);
    setShowCreate(false);
  };

  const handleDeleteTest = async (id: string) => {
    await deleteDbTest(id);
    setDbTests((prev) => prev.filter((t) => t.id !== id));
  };

  const isDirty = value !== saved;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">System Prompt</h1>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Live system prompt sent to the AI on every chat request. Changes take effect immediately — no redeployment needed.
          {source === 'compiled' && (
            <span style={{ color: 'var(--color-warning, #facc15)' }}>
              {' '}Showing the compiled fallback — save to make it live from the DB.
            </span>
          )}
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
            {successMsg && <span className="text-sm" style={{ color: 'var(--color-success, #4ade80)' }}>{successMsg}</span>}
            {error && <span className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</span>}
          </div>

          {/* ── Scenario tests ── */}
          <div className="space-y-3" style={{ paddingTop: '32px' }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold mb-1">Gold Standard Scenarios</h2>
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                  Ideal conversations used to evaluate and tune the agent. Static tests are from the codebase; custom tests are saved to the DB.
                </p>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setShowCreate((v) => !v)}
                style={{ flexShrink: 0 }}
              >
                {showCreate ? '✕ Cancel' : '+ New test'}
              </button>
            </div>

            {showCreate && (
              <CreateTestForm
                onSave={handleCreateTest}
                onCancel={() => setShowCreate(false)}
              />
            )}

            {/* Static tests from codebase */}
            {ALL_TESTS.map((t) => (
              <TestCard key={t.id} test={t} />
            ))}

            {/* DB tests */}
            {testsLoading ? (
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Loading custom tests…</p>
            ) : dbTests.length > 0 ? (
              dbTests.map((t) => (
                <TestCard
                  key={t.id}
                  test={t}
                  onDelete={() => handleDeleteTest(t.id)}
                />
              ))
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
