const BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

async function run({ systemPrompt, userPrompt }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error('GROQ_API_KEY is not set'), { status: 500 });
  }

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
    throw Object.assign(new Error(`Groq request failed (${res.status}): ${text || res.statusText}`), { status: 502 });
  }

  const data = await res.json();
  const contentMd = data.choices?.[0]?.message?.content?.trim();
  if (!contentMd) {
    throw Object.assign(new Error('Groq returned an empty response'), { status: 502 });
  }

  return { contentMd, model: `groq:${MODEL}` };
}

module.exports = {
  run,
  label: 'Groq (cloud)',
  local: false,
  dataNotice: 'Company profile data is sent to Groq’s cloud API (a third-party AI processor) to generate this document.',
};
