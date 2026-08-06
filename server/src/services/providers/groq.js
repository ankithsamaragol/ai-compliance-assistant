const BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const MAX_AUTO_RETRY_SECONDS = 30;

function parseRetrySeconds(message) {
  // Groq formats this as e.g. "try again in 30.12s" (per-minute limit) or
  // "try again in 1h14m0.96s" (daily limit) — parse whichever components are present.
  const match = /try again in\s+(?:([\d.]+)h)?\s*(?:([\d.]+)m)?\s*(?:([\d.]+)s)?/i.exec(message || '');
  if (!match || (!match[1] && !match[2] && !match[3])) return 20;
  const hours = parseFloat(match[1] || '0');
  const minutes = parseFloat(match[2] || '0');
  const seconds = parseFloat(match[3] || '0');
  return Math.ceil(hours * 3600 + minutes * 60 + seconds) + 1;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGroq({ apiKey, systemPrompt, userPrompt, history, maxTokens }) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens || 8000,
      messages: [
        { role: 'system', content: systemPrompt },
        ...(history || []),
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Groq request failed (${res.status}): ${text || res.statusText}`);
    err.status = res.status === 429 ? 429 : 502;
    err.rawBody = text;
    throw err;
  }

  const data = await res.json();
  const contentMd = data.choices?.[0]?.message?.content?.trim();
  if (!contentMd) {
    throw Object.assign(new Error('Groq returned an empty response'), { status: 502 });
  }
  return contentMd;
}

async function run({ systemPrompt, userPrompt, history, maxTokens }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error('GROQ_API_KEY is not set'), { status: 500 });
  }

  try {
    const contentMd = await callGroq({ apiKey, systemPrompt, userPrompt, history, maxTokens });
    return { contentMd, model: `groq:${MODEL}` };
  } catch (err) {
    if (err.status !== 429) throw err;
    const waitSeconds = parseRetrySeconds(err.rawBody);
    if (waitSeconds > MAX_AUTO_RETRY_SECONDS) {
      // Daily quota exhausted, not the per-minute limit — waiting here would block the request
      // for potentially hours. Fail fast with a clear message instead of hanging.
      const isDailyLimit = /tokens per day/i.test(err.rawBody || '');
      err.message = isDailyLimit
        ? `Groq's daily free-tier quota is exhausted. Try again in ~${Math.ceil(waitSeconds / 60)} minutes, or switch to the local Ollama provider.`
        : err.message;
      throw err;
    }
    // Short per-minute limit — Groq tells us exactly how long to wait, so retry once.
    await sleep(waitSeconds * 1000);
    const contentMd = await callGroq({ apiKey, systemPrompt, userPrompt, history, maxTokens });
    return { contentMd, model: `groq:${MODEL}` };
  }
}

module.exports = {
  run,
  label: 'Groq (cloud)',
  local: false,
  dataNotice: 'Company profile data is sent to Groq’s cloud API (a third-party AI processor) to generate this document.',
};
