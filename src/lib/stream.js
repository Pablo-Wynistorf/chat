import { getSettings } from './settings';
import { streamChatViaLambda, fetchModelsViaLambda } from './api';

export function getConfig() {
  const s = getSettings();
  return {
    endpoint: (s.endpoint || '').replace(/\/$/, ''),
    apiKey: s.apiKey || '',
    model: s.selectedModel || '',
    system: s.systemPrompt || '',
    maxTokens: Math.min(s.maxTokens || 4096, 65536),
    temperature: s.temperature ?? 1,
  };
}

export async function streamChat(chat, abortController, onDelta, onDone) {
  const { endpoint, apiKey, model, maxTokens, temperature } = getConfig();

  const messages = chat.messages.map(m => {
    const msgText = m.fileContent
      ? [m.fileContent, m.content].filter(Boolean).join('\n\n')
      : m.content;
    if (m.images?.length) {
      const parts = m.images.map(url => ({ type: 'image_url', image_url: { url } }));
      if (msgText) parts.push({ type: 'text', text: msgText });
      return { role: m.role, content: parts };
    }
    return { role: m.role, content: msgText };
  });

  await streamChatViaLambda(
    { endpoint, apiKey, messages, model, maxTokens, temperature },
    abortController,
    onDelta,
    onDone,
  );
}

export async function fetchModels(endpoint, apiKey) {
  return fetchModelsViaLambda(endpoint, apiKey);
}
