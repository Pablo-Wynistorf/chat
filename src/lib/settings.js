// Settings state — lives in memory, persisted to DynamoDB only.

let _settings = {
  providers: [],       // Array of { id, name, endpoint, apiKey }
  selectedProvider: '', // provider id
  selectedModel: '',
  systemPrompt: '',
  maxTokens: 4096,
  temperature: 1,
  mcpServers: [],
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

/** Get the active provider config, or null */
export function getActiveProvider() {
  const p = _settings.providers.find(p => p.id === _settings.selectedProvider);
  return p || _settings.providers[0] || null;
}
