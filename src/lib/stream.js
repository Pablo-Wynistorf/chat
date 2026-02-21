import { getSettings, getActiveProvider } from './settings';
import { streamChatViaLambda, fetchModelsViaLambda } from './api';

export function getConfig() {
  const s = getSettings();
  const provider = getActiveProvider();
  return {
    endpoint: (provider?.endpoint || '').replace(/\/$/, ''),
    apiKey: provider?.apiKey || '',
    model: s.selectedModel || '',
    system: s.systemPrompt || '',
    maxTokens: Math.min(s.maxTokens || 4096, 65536),
    temperature: s.temperature ?? 1,
    mcpServers: (s.mcpServers || []).filter(s => s.enabled),
  };
}

export async function streamChat(chat, abortController, onDelta, onDone, onToolCall) {
  const { endpoint, apiKey, model, maxTokens, temperature, mcpServers } = getConfig();

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

  const mcpPayload = mcpServers.map(s => ({
    url: s.url,
    name: s.name || undefined,
    headers: (s.headers && Object.keys(s.headers).length > 0) ? s.headers : undefined,
  }));

  await streamChatViaLambda(
    { endpoint, apiKey, messages, model, maxTokens, temperature, mcpServers: mcpPayload },
    abortController,
    onDelta,
    onDone,
    onToolCall,
  );
}

export async function fetchModels(endpoint, apiKey) {
  return fetchModelsViaLambda(endpoint, apiKey);
}
