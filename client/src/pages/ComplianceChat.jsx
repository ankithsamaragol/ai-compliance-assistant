import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

export default function ComplianceChat({ company, providers, provider, setProvider }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    api.listChatMessages(company.id).then(setMessages).catch((err) => setError(err.message));
  }, [company.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const currentProvider = providers.find((p) => p.key === provider);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setError('');
    setInput('');
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: 'user', content: text }]);
    setSending(true);
    try {
      const { message } = await api.sendChatMessage(company.id, text, provider);
      setMessages((prev) => [...prev, message]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function clear() {
    try {
      await api.clearChat(company.id);
      setMessages([]);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Compliance Chat</h3>
          <div className="meta" style={{ marginTop: 4 }}>
            Ask about this company's vendors, gaps, and compliance status — grounded in the real data on file.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={provider} onChange={(e) => setProvider(e.target.value)} style={{ width: 'auto' }}>
            {providers.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          {messages.length > 0 && (
            <button className="secondary" style={{ marginTop: 0, fontSize: 12 }} onClick={clear}>Clear chat</button>
          )}
        </div>
      </div>

      {currentProvider?.dataNotice && (
        <div className={`data-notice ${currentProvider.local ? 'data-notice-local' : 'data-notice-cloud'}`} style={{ marginTop: 12 }}>
          {currentProvider.local ? '🔒' : '☁️'} {currentProvider.dataNotice}
        </div>
      )}

      <div className="chat-window">
        {messages.length === 0 && (
          <div className="meta" style={{ padding: '20px 0' }}>
            No messages yet. Try: "Why is Stripe classified the way it is?" or "What's my biggest compliance gap right now?"
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-bubble chat-${m.role}`}>
            <div className="chat-role">{m.role === 'user' ? 'You' : 'Assistant'}</div>
            <div className="chat-content">{m.content}</div>
          </div>
        ))}
        {sending && (
          <div className="chat-bubble chat-assistant">
            <div className="chat-role">Assistant</div>
            <div className="chat-content meta">Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <div className="error">{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about this company's compliance status…"
          style={{ minHeight: 44, flex: 1, resize: 'vertical' }}
        />
        <button onClick={send} disabled={sending || !input.trim()} style={{ marginTop: 0 }}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
