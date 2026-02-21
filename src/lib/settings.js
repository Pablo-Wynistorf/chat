// Settings state — lives in memory, persisted to DynamoDB only.
// No localStorage for sensitive data (endpoint, apiKey, etc.)

let _settings = {
  endpoint: '',
  apiKey: '',
  systemPrompt: '',
  maxTokens: 4096,
  temperature: 1,
  selectedModel: '',
  mcpServers: [], // Array of { name, url, headers?: {}, enabled: boolean }
};

const _listeners = new Set();

export function getSettings() {
  return { ..._settings };
}

export function getSetting(key) {
  return _settings[key] ?? '';
}

export function updateSettings(partial) {
  _settings = { ..._settings, ...partial };
  _listeners.forEach(fn => fn(_settings));
}

export function onSettingsChange(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
