import { Link } from 'react-router-dom';

export type TestMessage = {
  role: 'user' | 'agent';
  content: string;
};

export type TestCase = {
  id: string;
  category: string;
  description: string;
  messages: TestMessage[];
};

const modules = import.meta.glob<{ default: TestCase }>('../data/tests/*.json', { eager: true });

export const ALL_TESTS: TestCase[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => a.id.localeCompare(b.id));

const CATEGORY_COLOURS: Record<string, string> = {
  food: 'pill-success',
  prayer_times: 'pill-warning',
  tradespeople: '',
  schools: '',
  wedding_halls: '',
  events: '',
  jobs: 'pill-success',
  interesting_facts: 'pill-warning',
  activities_clubs: 'pill-success',
};

export function categoryPill(category: string) {
  const cls = CATEGORY_COLOURS[category] ?? '';
  return (
    <span className={`pill ${cls}`}>
      {category.replace(/_/g, ' ')}
    </span>
  );
}

export function TestsPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Tests</h1>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Golden-path conversation threads used to evaluate and tune the agent's responses.
        </p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: '#0e1115' }}>
              <th className="px-4 py-3 font-medium" style={{ color: 'var(--color-muted)' }}>#</th>
              <th className="px-4 py-3 font-medium" style={{ color: 'var(--color-muted)' }}>Category</th>
              <th className="px-4 py-3 font-medium" style={{ color: 'var(--color-muted)' }}>Description</th>
              <th className="px-4 py-3 font-medium text-right" style={{ color: 'var(--color-muted)' }}>Turns</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {ALL_TESTS.map((t, i) => (
              <tr key={t.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--color-muted)' }}>
                  {String(i + 1).padStart(3, '0')}
                </td>
                <td className="px-4 py-3">{categoryPill(t.category)}</td>
                <td className="px-4 py-3">{t.description}</td>
                <td className="px-4 py-3 text-right font-mono text-xs" style={{ color: 'var(--color-muted)' }}>
                  {t.messages.length}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/tests/${t.id}`} className="btn">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
