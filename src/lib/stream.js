import { getCfgValue } from './storage';

export function getConfig() {
  return {
    endpoint: (getCfgValue('endpoint') || '').replace(/\/$/, ''),
    apiKey: getCfgValue('apikey') || '',
    model: getCfgValue('model') || 'global.anthropic.claude-opus-4-6-v1',
    system: getCfgValue('system') || '',
    maxTokens: Math.min(parseInt(getCfgValue('maxtokens')) || 4096, 65536),
    temperature: parseFloat(getCfgValue('temp') || '1'),
  };
}

export async function streamChat(chat, abortController, onDelta, onDone, onError) {
  const { endpoint, apiKey, model, maxTokens, temperature } = getConfig();

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: chat.messages.map(m => {
        // Merge file content back into the API payload
        const msgText = m.fileContent
          ? [m.fileContent, m.content].filter(Boolean).join('\n\n')
          : m.content;
        if (m.images?.length) {
          const parts = m.images.map(url => ({ type: 'image_url', image_url: { url } }));
          if (msgText) parts.push({ type: 'text', text: msgText });
          return { role: m.role, content: parts };
        }
        return { role: m.role, content: msgText };
      }),
      max_tokens: maxTokens,
      temperature,
      stream: true,
    }),
    signal: abortController.signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let stopReason = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') break;
      try {
        const parsed = JSON.parse(data);
        const choice = parsed.choices?.[0];
        const delta = choice?.delta?.content;
        if (choice?.finish_reason === 'length') stopReason = 'length';
        if (delta) {
          fullText += delta;
          onDelta(fullText);
        }
      } catch { /* skip */ }
    }
  }

  onDone(fullText, stopReason);
}

export async function fetchModels(endpoint, apiKey) {
  const res = await fetch(`${endpoint}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error('Failed to fetch models');
  const json = await res.json();
  return (json.data || []).map(m => m.id).sort();
}
