const BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

function parseRetrySeconds(message) {
  const match = /try again in ([\d.]+)s/i.exec(message || '');
  return match ? Math.ceil(parseFloat(match[1])) + 1 : 20;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGroq({ apiKey, systemPrompt, userPrompt }) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      messages: [
        { role: 'system', content: systemPrompt },
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

async function run({ systemPrompt, userPrompt }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error('GROQ_API_KEY is not set'), { status: 500 });
  }

  try {
    const contentMd = await callGroq({ apiKey, systemPrompt, userPrompt });
    return { contentMd, model: `groq:${MODEL}` };
  } catch (err) {
    if (err.status !== 429) throw err;
    // Free-tier tokens-per-minute limit — Groq tells us exactly how long to wait, so retry once.
    const waitMs = parseRetrySeconds(err.rawBody) * 1000;
    await sleep(waitMs);
    const contentMd = await callGroq({ apiKey, systemPrompt, userPrompt });
    return { contentMd, model: `groq:${MODEL}` };
  }
}

module.exports = {
  run,
  label: 'Groq (cloud)',
  local: false,
  dataNotice: 'Company profile data is sent to Groq’s cloud API (a third-party AI processor) to generate this document.',
};
