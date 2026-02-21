import { getIdToken } from './auth';
import { generateClient } from 'aws-amplify/data';

let _streamUrl = '';
let _apiEndpoint = '';

export function setBackendUrls(apiEndpoint, streamUrl) {
  _apiEndpoint = apiEndpoint?.replace(/\/$/, '') || '';
  _streamUrl = streamUrl?.replace(/\/$/, '') || '';
}

// ── Data client for DynamoDB (UserSettings) ──
let _dataClient = null;
export function getDataClient() {
  if (!_dataClient) _dataClient = generateClient();
  return _dataClient;
}

// ── Save user settings to DynamoDB ──
export async function saveUserSettings(settings) {
  const client = getDataClient();
  const { data: existing } = await client.models.UserSettings.list();
  if (existing && existing.length > 0) {
    return client.models.UserSettings.update({
      id: existing[0].id,
      ...settings,
    });
  }
  return client.models.UserSettings.create(settings);
}

// ── Load user settings from DynamoDB ──
export async function loadUserSettings() {
  const client = getDataClient();
  const { data } = await client.models.UserSettings.list();
  return data?.[0] || null;
}

// ── Chat CRUD ──

export async function createChat(chat) {
  const client = getDataClient();
  return client.models.Chat.create({
    id: chat.id,
    title: chat.title,
    created: chat.created,
  });
}

export async function updateChat(id, fields) {
  const client = getDataClient();
  return client.models.Chat.update({ id, ...fields });
}

export async function deleteChat(id) {
  const client = getDataClient();
  // Delete all messages first
  const { data: msgs } = await client.models.ChatMessage.messagesByChatId({ chatId: id });
  await Promise.all((msgs || []).map(m => client.models.ChatMessage.delete({ id: m.id })));
  return client.models.Chat.delete({ id });
}

export async function loadAllChats() {
  const client = getDataClient();
  const { data } = await client.models.Chat.list({ limit: 1000 });
  return (data || []).sort((a, b) => b.created - a.created);
}

export async function deleteAllChats() {
  const client = getDataClient();
  const { data: chats } = await client.models.Chat.list({ limit: 1000 });
  for (const chat of (chats || [])) {
    const { data: msgs } = await client.models.ChatMessage.messagesByChatId({ chatId: chat.id });
    await Promise.all((msgs || []).map(m => client.models.ChatMessage.delete({ id: m.id })));
    await client.models.Chat.delete({ id: chat.id });
  }
}

// ── ChatMessage CRUD ──

export async function createChatMessage(chatId, msg, sortKey) {
  const client = getDataClient();
  return client.models.ChatMessage.create({
    chatId,
    sortKey,
    role: msg.role,
    content: msg.content || '',
    fileContent: msg.fileContent || null,
    files: msg.files ? JSON.stringify(msg.files) : null,
  });
}

export async function loadChatMessages(chatId) {
  const client = getDataClient();
  const { data } = await client.models.ChatMessage.messagesByChatId(
    { chatId },
    { sortDirection: 'ASC', limit: 5000 },
  );
  return (data || []).map(m => ({
    role: m.role,
    content: m.content,
    ...(m.fileContent ? { fileContent: m.fileContent } : {}),
    ...(m.files ? { files: JSON.parse(m.files) } : {}),
  }));
}

export async function deleteChatMessages(chatId) {
  const client = getDataClient();
  const { data: msgs } = await client.models.ChatMessage.messagesByChatId({ chatId });
  await Promise.all((msgs || []).map(m => client.models.ChatMessage.delete({ id: m.id })));
}

export async function deleteChatMessagesFrom(chatId, fromSortKey) {
  const client = getDataClient();
  const { data: msgs } = await client.models.ChatMessage.messagesByChatId(
    { chatId },
    { sortDirection: 'ASC', limit: 5000 },
  );
  const toDelete = (msgs || []).filter(m => m.sortKey >= fromSortKey);
  await Promise.all(toDelete.map(m => client.models.ChatMessage.delete({ id: m.id })));
}

// ── Fetch models via Lambda proxy ──
export async function fetchModelsViaLambda(endpoint, apiKey) {
  const token = await getIdToken();
  const res = await fetch(`${_apiEndpoint}/api/models`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
    },
    body: JSON.stringify({ action: 'fetchModels', endpoint, apiKey }),
  });
  if (!res.ok) throw new Error('Failed to fetch models');
  const json = await res.json();
  return (json.data || []).map((m) => m.id).sort();
}

// ── Stream chat via Lambda Function URL ──
export async function streamChatViaLambda(
  { endpoint, apiKey, messages, model, maxTokens, temperature, mcpServers },
  abortController,
  onDelta,
  onDone,
  onToolCall,
) {
  const token = await getIdToken();

  const payload = {
    endpoint,
    apiKey,
    messages,
    model,
    max_tokens: maxTokens,
    temperature,
  };
  if (mcpServers && mcpServers.length > 0) {
    payload.mcp_servers = mcpServers;
  }

  const res = await fetch(_streamUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
    },
    body: JSON.stringify(payload),
    signal: abortController.signal,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    let message = `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(errBody);
      // Handle Anthropic-style: { error: { message } } or { error: "string" }
      message = parsed.error?.message || parsed.error || parsed.message || message;
    } catch { /* use raw text if not JSON */ if (errBody) message = errBody; }
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let stopReason = null;
  let usage = null; // { prompt_tokens, completion_tokens }

  // Track active tool calls by index
  const activeToolCalls = {};

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

        // Handle error events from the upstream API (e.g. Anthropic error objects)
        if (parsed.type === 'error' || parsed.error) {
          const errMsg = parsed.error?.message || parsed.error || 'Stream error';
          throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
        }

        const choice = parsed.choices?.[0];
        if (!choice) continue;

        // Handle tool call deltas
        if (choice.delta?.tool_calls) {
          for (const tc of choice.delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (tc.id) {
              // New tool call starting
              activeToolCalls[idx] = {
                id: tc.id,
                name: tc.function?.name || '',
                arguments: tc.function?.arguments || '',
              };
              if (onToolCall) onToolCall({ type: 'start', ...activeToolCalls[idx] });
            } else if (activeToolCalls[idx]) {
              // Argument chunk
              activeToolCalls[idx].arguments += tc.function?.arguments || '';
            }
          }
        }

        // Handle finish_reason: tool_calls — mark tool calls as executing
        if (choice.finish_reason === 'tool_calls') {
          for (const idx of Object.keys(activeToolCalls)) {
            if (onToolCall) onToolCall({ type: 'executing', ...activeToolCalls[idx] });
          }
        }

        // Handle new assistant turn after tool execution (role: assistant in delta)
        if (choice.delta?.role === 'assistant' && Object.keys(activeToolCalls).length > 0) {
          for (const idx of Object.keys(activeToolCalls)) {
            if (onToolCall) onToolCall({ type: 'done', ...activeToolCalls[idx] });
          }
          // Reset for next round
          for (const k of Object.keys(activeToolCalls)) delete activeToolCalls[k];
        }

        const delta = choice.delta?.content;
        if (choice.finish_reason === 'length') stopReason = 'length';
        if (delta) {
          fullText += delta;
          onDelta(fullText);
        }

        // Capture usage stats if present (OpenAI sends in final chunk)
        if (parsed.usage) {
          usage = {
            prompt_tokens: parsed.usage.prompt_tokens || 0,
            completion_tokens: parsed.usage.completion_tokens || 0,
          };
        }
      } catch (e) {
        // Re-throw stream errors (from error event detection above)
        if (e?.message && e.message !== 'skip') throw e;
      }
    }
  }

  // Mark any remaining tool calls as done
  for (const idx of Object.keys(activeToolCalls)) {
    if (onToolCall) onToolCall({ type: 'done', ...activeToolCalls[idx] });
  }

  onDone(fullText, stopReason, usage);
}
