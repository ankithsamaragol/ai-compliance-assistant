const BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';

async function run({ systemPrompt, userPrompt }) {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      options: { num_predict: 4096 },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw Object.assign(new Error(`Ollama request failed (${res.status}): ${text || res.statusText}`), { status: 502 });
  }

  const data = await res.json();
  const contentMd = data.message?.content?.trim();
  if (!contentMd) {
    throw Object.assign(new Error('Ollama returned an empty response'), { status: 502 });
  }

  return { contentMd, model: `ollama:${MODEL}` };
}

module.exports = {
  run,
  label: 'Local (Ollama)',
  local: true,
  dataNotice: 'Runs entirely on this machine — company profile data never leaves the local system.',
};
