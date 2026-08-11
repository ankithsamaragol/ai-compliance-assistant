import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import ProviderNotice from '../components/ProviderNotice';
import { IconSparkle, IconUser } from '../components/Icons';

const SUGGESTIONS = [
  "What's my biggest compliance gap right now?",
  'Why is my highest-risk vendor classified that way?',
  "What documents am I missing for GDPR?",
];

export default function ComplianceChat({ company, providers, provider, setProvider }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    api.listChatMessages(company.id).then(setMessages).catch((err) => setError(err.message));
  }, [company.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const currentProvider = providers.find((p) => p.key === provider);

  async function send(overrideText) {
    const text = (overrideText ?? input).trim();
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

  function useSuggestion(text) {
    setInput(text);
    textareaRef.current?.focus();
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
          <ProviderNotice provider={currentProvider} />
          <select value={provider} onChange={(e) => setProvider(e.target.value)} style={{ width: 'auto' }}>
            {providers.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          {messages.length > 0 && (
            <button className="secondary" style={{ marginTop: 0, fontSize: 12 }} onClick={clear}>Clear chat</button>
          )}
        </div>
      </div>

      <div className="chat-window">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon"><IconSparkle size={22} /></div>
            <div className="chat-empty-title">Ask me anything about {company.name}'s compliance status</div>
            <div className="chat-empty-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chat-suggestion-chip" onClick={() => useSuggestion(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-row chat-row-${m.role}`}>
            <div className={`chat-avatar chat-avatar-${m.role}`}>
              {m.role === 'user' ? <IconUser size={14} /> : <IconSparkle size={14} />}
            </div>
            <div className={`chat-bubble chat-${m.role}`}>
              <div className="chat-content">{m.content}</div>
            </div>
          </div>
        ))}
        {sending && (
          <div className="chat-row chat-row-assistant">
            <div className="chat-avatar chat-avatar-assistant"><IconSparkle size={14} /></div>
            <div className="chat-bubble chat-assistant">
              <div className="chat-typing"><span /><span /><span /></div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <div className="error">{error}</div>}

      <div className="chat-composer">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about this company's compliance status…"
          rows={1}
        />
        <button onClick={() => send()} disabled={sending || !input.trim()} style={{ marginTop: 0 }}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
