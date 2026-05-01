import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function SystemPromptPage() {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('system_config')
      .select('value')
      .eq('key', 'system_prompt')
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        const v = data?.value ?? '';
        setValue(v);
        setSaved(v);
        setLoading(false);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    const { error } = await supabase
      .from('system_config')
      .upsert({ key: 'system_prompt', value, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) {
      setError(error.message);
    } else {
      setSaved(value);
      setSuccessMsg('Saved — live for all users immediately.');
    }
  };

  const isDirty = value !== saved;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">System Prompt</h1>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Live system prompt sent to the AI on every chat request. Changes take effect immediately — no redeployment needed.
          {loading ? '' : !saved && ' No saved prompt yet — the compiled fallback is in use.'}
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
