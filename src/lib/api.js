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
  { endpoint, apiKey, messages, model, maxTokens, temperature },
  abortController,
  onDelta,
  onDone,
) {
  const token = await getIdToken();
  const res = await fetch(_streamUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      endpoint,
      apiKey,
      messages,
      model,
      max_tokens: maxTokens,
      temperature,
    }),
    signal: abortController.signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
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
      } catch {
        /* skip */
      }
    }
  }

  onDone(fullText, stopReason);
}
