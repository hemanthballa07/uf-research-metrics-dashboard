import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/apiClient';

type Source = { id: number; title: string };

export function AskPage() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onAsk() {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setAnswer('');
    setSources([]);
    setError(null);
    try {
      await api.ask(q, {
        onText: (delta) => setAnswer((prev) => prev + delta),
        onSources: (grants) => setSources(grants.map((g) => ({ id: g.id, title: g.title }))),
        onError: (message) => setError(message),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Ask the grants</h1>
      <p style={{ color: '#666', marginTop: 0 }}>
        Natural-language questions answered from the most relevant grants (semantic search +
        Claude). Answers cite grant IDs in brackets, e.g. [123].
      </p>

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onAsk();
        }}
        placeholder="e.g. Which NIH-funded cancer grants are expiring within a year?"
        rows={3}
        style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', boxSizing: 'border-box' }}
      />
      <div style={{ marginTop: '0.5rem' }}>
        <button onClick={onAsk} disabled={loading || !question.trim()} style={{ padding: '0.5rem 1.25rem' }}>
          {loading ? 'Thinking…' : 'Ask (⌘/Ctrl+Enter)'}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: '1rem', color: '#b00020', background: '#fde', padding: '0.75rem', borderRadius: 4 }}>
          {error}
        </div>
      )}

      {answer && (
        <div style={{ marginTop: '1.5rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{answer}</div>
      )}

      {sources.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3>Sources</h3>
          <ul>
            {sources.map((s) => (
              <li key={s.id}>
                <Link to={`/grants?search=${encodeURIComponent(s.title)}`}>
                  [{s.id}] {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
