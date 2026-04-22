import { Link, useParams, Navigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ALL_TESTS, categoryPill } from './Tests';

export function TestDetailPage() {
  const { id = '' } = useParams();
  const test = ALL_TESTS.find((t) => t.id === id);

  if (!test) return <Navigate to="/tests" replace />;

  const turns = test.messages.length;
  const userTurns = test.messages.filter((m) => m.role === 'user').length;

  return (
    <>
      <div className="mb-6 flex items-start gap-4">
        <Link to="/tests" className="btn mt-0.5">← Back</Link>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-semibold">{test.id.replace(/_/g, ' ')}</h1>
            {categoryPill(test.category)}
          </div>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>{test.description}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
            {turns} messages · {userTurns} user turns
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 max-w-3xl">
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
    </>
  );
}
