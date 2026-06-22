// Minimal, dependency-free model callers for the demo. Bring your own key (BYOK).
//
// Pick any two models to run side by side via MODEL_A / MODEL_B (see demo.mjs).
// Each provider reads its own API key from the environment; with no key set, that
// model answers in a deterministic OFFLINE MOCK so the demo runs with zero setup.
// The mock is grounded ONLY in the facts passed to it — so when SAIHM forgets a
// fact, the mock stops citing it too, and you still see the erasure effect offline.
//
// Endpoints/model ids below are the providers' standard OpenAI-compatible defaults,
// current as of 2026-06. Model ids change often; override either without editing code:
//   SAIHM_<KEY>_URL  and  SAIHM_<KEY>_MODEL   (e.g. SAIHM_QWEN_MODEL=qwen-plus-latest)

export const PROVIDERS = {
  claude:   { label: 'Claude',   kind: 'anthropic', keyEnv: 'ANTHROPIC_API_KEY', url: 'https://api.anthropic.com/v1/messages', model: 'claude-haiku-4-5-20251001' },
  deepseek: { label: 'DeepSeek', kind: 'openai',    keyEnv: 'DEEPSEEK_API_KEY',  url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-v4-flash' },
  qwen:     { label: 'Qwen',     kind: 'openai',    keyEnv: 'DASHSCOPE_API_KEY', url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-plus' },
  kimi:     { label: 'Kimi',     kind: 'openai',    keyEnv: 'MOONSHOT_API_KEY',  url: 'https://api.moonshot.ai/v1/chat/completions', model: 'moonshot-v1-8k' },
  glm:      { label: 'GLM',      kind: 'openai',    keyEnv: 'ZHIPUAI_API_KEY',   url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model: 'glm-4.5-flash' },
  openai:   { label: 'GPT',      kind: 'openai',    keyEnv: 'OPENAI_API_KEY',    url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
};

function mockAnswer(label, facts) {
  const known = facts.length ? facts.map((f) => '  - ' + f).join('\n') : '  (nothing remembered)';
  const allergy = facts.find((f) => /allerg/i.test(f));
  const medical = allergy
    ? `Medically: per "${allergy}", avoid the substance it names.`
    : `Medically: nothing is remembered on that, so I won't guess.`;
  return `[${label} - offline mock]\nWhat I know about you:\n${known}\n${medical}`;
}

export async function ask(providerKey, system, user, facts) {
  const p = PROVIDERS[providerKey];
  if (!p) return `[unknown model '${providerKey}' - try: ${Object.keys(PROVIDERS).join(', ')}]`;
  const apiKey = process.env[p.keyEnv];
  if (!apiKey) return mockAnswer(p.label, facts);

  const KEY = providerKey.toUpperCase();
  const url = process.env[`SAIHM_${KEY}_URL`] || p.url;
  const model = process.env[`SAIHM_${KEY}_MODEL`] || p.model;
  try {
    let res;
    if (p.kind === 'anthropic') {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 256, system, messages: [{ role: 'user', content: user }] }),
      });
      if (!res.ok) return `[${p.label} - HTTP ${res.status}] check ${p.keyEnv}`;
      const data = await res.json();
      return `[${p.label} - live]\n` + (data?.content?.[0]?.text ?? '(no text)');
    }
    // OpenAI-compatible (DeepSeek, Qwen, Kimi, GLM, GPT, and most others).
    res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 256, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
    if (!res.ok) return `[${p.label} - HTTP ${res.status}] check ${p.keyEnv}`;
    const data = await res.json();
    return `[${p.label} - live]\n` + (data?.choices?.[0]?.message?.content ?? '(no text)');
  } catch (e) {
    return `[${p.label} - transport error] ${e?.message ?? e}`;
  }
}
