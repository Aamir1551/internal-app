import { useEffect, useState } from 'react';
import { getSystemPrompt, saveSystemPrompt } from '@/lib/adminApi';

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
        </div>
      )}
    </>
  );
}
