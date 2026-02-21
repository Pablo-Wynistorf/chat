/**
 * Multi-provider adapter — detects provider from endpoint URL and adapts
 * API calls (auth headers, paths, request/response format).
 * Always returns OpenAI-compatible format to the frontend.
 */

export type Provider = 'anthropic' | 'google' | 'openai-compat';

export function detectProvider(endpoint: string): Provider {
  const lower = endpoint.toLowerCase();
  if (lower.includes('anthropic.com') || lower.includes('claude')) return 'anthropic';
  if (lower.includes('generativelanguage.googleapis.com') || lower.includes('gemini')) return 'google';
  return 'openai-compat';
}

/** Build headers for the upstream API call */
export function buildHeaders(provider: Provider, apiKey: string): Record<string, string> {
  switch (provider) {
    case 'anthropic':
      return {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      };
    case 'google':
      return { 'Content-Type': 'application/json' };
    case 'openai-compat':
    default:
      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      };
  }
}

/** Ensure Anthropic endpoints include /v1 path */
function anthropicBase(endpoint: string): string {
  const base = endpoint.replace(/\/$/, '');
  // If user provided https://api.anthropic.com (no /v1), add it
  if (!base.endsWith('/v1') && !base.includes('/v1/')) return `${base}/v1`;
  return base;
}

/** Build the fetch models URL */
export function buildModelsUrl(provider: Provider, endpoint: string, apiKey: string): string {
  const base = endpoint.replace(/\/$/, '');
  switch (provider) {
    case 'anthropic':
      return `${anthropicBase(endpoint)}/models`;
    case 'google':
      return `${base}/models?key=${apiKey}`;
    case 'openai-compat':
    default:
      return `${base}/models`;
  }
}

/** Build headers for fetching models (GET request, no Content-Type needed for some) */
export function buildModelsHeaders(provider: Provider, apiKey: string): Record<string, string> {
  switch (provider) {
    case 'anthropic':
      return { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
    case 'google':
      return {};
    case 'openai-compat':
    default:
      return { Authorization: `Bearer ${apiKey}` };
  }
}

/** Normalize models list response to OpenAI format: { data: [{ id: "model-name" }] } */
export function normalizeModelsResponse(provider: Provider, json: any): { data: { id: string }[] } {
  switch (provider) {
    case 'anthropic': {
      // Anthropic: { data: [{ id, display_name, ... }] } — already has .data[].id
      const models = json.data || [];
      return { data: models.map((m: any) => ({ id: m.id })) };
    }
    case 'google': {
      // Google: { models: [{ name: "models/gemini-pro", displayName, ... }] }
      const models = json.models || [];
      return {
        data: models
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => ({ id: m.name?.replace('models/', '') || m.name })),
      };
    }
    case 'openai-compat':
    default:
      return json;
  }
}

/** Build the chat completions URL */
export function buildChatUrl(provider: Provider, endpoint: string, model: string, apiKey: string): string {
  const base = endpoint.replace(/\/$/, '');
  switch (provider) {
    case 'anthropic':
      return `${anthropicBase(endpoint)}/messages`;
    case 'google':
      return `${base}/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    case 'openai-compat':
    default:
      return `${base}/chat/completions`;
  }
}

/** Build the chat request body in the provider's native format */
export function buildChatBody(
  provider: Provider,
  opts: {
    model: string;
    messages: any[];
    max_tokens: number;
    temperature: number;
    stream: boolean;
    mcp_servers?: any[];
  },
): any {
  switch (provider) {
    case 'anthropic': {
      // Anthropic expects system as a top-level param, not in messages
      const systemMsgs = opts.messages.filter((m: any) => m.role === 'system');
      const nonSystemMsgs = opts.messages.filter((m: any) => m.role !== 'system');
      return {
        model: opts.model,
        max_tokens: opts.max_tokens || 4096,
        temperature: opts.temperature,
        stream: opts.stream,
        ...(systemMsgs.length > 0 ? { system: systemMsgs.map((m: any) => m.content).join('\n\n') } : {}),
        messages: nonSystemMsgs,
      };
    }
    case 'google': {
      // Gemini format: { contents: [{ role, parts: [{ text }] }], generationConfig }
      const contents = opts.messages
        .filter((m: any) => m.role !== 'system')
        .map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
        }));
      const systemInstruction = opts.messages
        .filter((m: any) => m.role === 'system')
        .map((m: any) => m.content)
        .join('\n\n');
      return {
        contents,
        ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
        generationConfig: {
          maxOutputTokens: opts.max_tokens || 4096,
          temperature: opts.temperature,
        },
      };
    }
    case 'openai-compat':
    default:
      return {
        model: opts.model,
        messages: opts.messages,
        max_tokens: opts.max_tokens,
        temperature: opts.temperature,
        stream: opts.stream,
        ...(opts.mcp_servers && opts.mcp_servers.length > 0 ? { mcp_servers: opts.mcp_servers } : {}),
      };
  }
}

/**
 * Transform a single SSE data line from a provider's native format
 * into OpenAI-compatible SSE format.
 * Returns the transformed line, or null to skip.
 */
export function normalizeSSELine(provider: Provider, data: string): string | null {
  if (data === '[DONE]') return 'data: [DONE]';

  switch (provider) {
    case 'anthropic': {
      // Anthropic SSE events: message_start, content_block_start, content_block_delta, message_delta, message_stop
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          return `data: ${JSON.stringify({
            choices: [{ index: 0, delta: { content: parsed.delta.text }, finish_reason: null }],
          })}`;
        }
        if (parsed.type === 'message_delta') {
          const stop = parsed.delta?.stop_reason;
          return `data: ${JSON.stringify({
            choices: [{ index: 0, delta: {}, finish_reason: stop === 'max_tokens' ? 'length' : (stop || 'stop') }],
          })}`;
        }
        if (parsed.type === 'message_stop') {
          return 'data: [DONE]';
        }
        // Skip other event types (message_start, content_block_start, ping, etc.)
        return null;
      } catch {
        return null;
      }
    }
    case 'google': {
      // Gemini SSE: data: { candidates: [{ content: { parts: [{ text }] }, finishReason }] }
      try {
        const parsed = JSON.parse(data);
        const candidate = parsed.candidates?.[0];
        if (!candidate) return null;
        const text = candidate.content?.parts?.[0]?.text || '';
        const finish = candidate.finishReason;
        if (text) {
          return `data: ${JSON.stringify({
            choices: [{ index: 0, delta: { content: text }, finish_reason: finish === 'MAX_TOKENS' ? 'length' : null }],
          })}`;
        }
        if (finish && finish !== 'STOP') {
          return `data: ${JSON.stringify({
            choices: [{ index: 0, delta: {}, finish_reason: finish === 'MAX_TOKENS' ? 'length' : 'stop' }],
          })}`;
        }
        if (finish === 'STOP') {
          return `data: ${JSON.stringify({
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          })}`;
        }
        return null;
      } catch {
        return null;
      }
    }
    case 'openai-compat':
    default:
      // Already in the right format, just pass through
      return `data: ${data}`;
  }
}
