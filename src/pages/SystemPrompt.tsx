import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getSystemPrompt, saveSystemPrompt } from '@/lib/adminApi';
import { ALL_TESTS, categoryPill } from './Tests';

const SCENARIO_IDS = [
  '001_food_recommendation',
  '002_prayer_times',
  '005_wedding_venue',
  '010_kids_activities',
];

const SCENARIO_TESTS = ALL_TESTS.filter((t) => SCENARIO_IDS.includes(t.id));

function ScenarioTest({ test }: { test: (typeof ALL_TESTS)[number] }) {
  const [open, setOpen] = useState(false);

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
        <span className="text-xs shrink-0" style={{ color: 'var(--color-muted)' }}>
          {open ? '▲ hide' : '▼ show'}
        </span>
      </button>

      {open && (
        <div
          className="flex flex-col gap-3 px-4 pb-4"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <div style={{ paddingTop: '12px' }} />
          {test.messages.map((msg, i) => (
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
      )}
    </div>
  );
}

export function SystemPromptPage() {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState('');
  const [source, setSource] = useState<'db' | 'compiled' | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    getSystemPrompt()
      .then(({ prompt, source }) => {
        setValue(prompt);
        setSaved(prompt);
        setSource(source);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await saveSystemPrompt(value);
      setSaved(value);
      setSource('db');
      setSuccessMsg('Saved — live for all users immediately.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
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
            <button
              className="btn btn-primary"
              onClick={save}
              disabled={saving || !isDirty}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {isDirty && (
              <span className="text-sm" style={{ color: 'var(--color-muted)' }}>Unsaved changes</span>
            )}
            {successMsg && (
              <span className="text-sm" style={{ color: 'var(--color-success, #4ade80)' }}>{successMsg}</span>
            )}
            {error && (
              <span className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</span>
            )}
          </div>

          {/* ── Gold standard scenario tests ── */}
          <div className="space-y-3" style={{ paddingTop: '24px' }}>
            <div>
              <h2 className="text-lg font-semibold mb-1">Gold Standard Scenarios</h2>
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                The ideal responses the agent should produce. Use these to verify the system prompt is working as intended.
              </p>
            </div>
            {SCENARIO_TESTS.map((t) => (
              <ScenarioTest key={t.id} test={t} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
