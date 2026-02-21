import { encode } from 'gpt-tokenizer';

/**
 * Count tokens in a messages array.
 * Uses cl100k_base (GPT-4/Claude approximate) — good enough for cost estimates.
 */
export function countTokens(messages) {
  let total = 0;
  for (const msg of messages) {
    total += 4; // message overhead
    const content = typeof msg.content === 'string'
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content.filter(p => p.type === 'text').map(p => p.text).join(' ')
        : '';
    if (content) total += encode(content).length;
    if (msg.role) total += encode(msg.role).length;
  }
  total += 2; // reply priming
  return total;
}

// Pricing per 1M tokens [input, output] in USD
// Covers major models — falls back to a reasonable default
const PRICING = {
  // OpenAI
  'gpt-4o':             [2.50, 10.00],
  'gpt-4o-mini':        [0.15, 0.60],
  'gpt-4-turbo':        [10.00, 30.00],
  'gpt-4':              [30.00, 60.00],
  'gpt-3.5-turbo':      [0.50, 1.50],
  'o1':                 [15.00, 60.00],
  'o1-mini':            [3.00, 12.00],
  'o1-pro':             [150.00, 600.00],
  'o3':                 [10.00, 40.00],
  'o3-mini':            [1.10, 4.40],
  'o4-mini':            [1.10, 4.40],
  'gpt-4.1':            [2.00, 8.00],
  'gpt-4.1-mini':       [0.40, 1.60],
  'gpt-4.1-nano':       [0.10, 0.40],
  // Anthropic
  'claude-sonnet-4-20250514':    [3.00, 15.00],
  'claude-3-7-sonnet-20250219':  [3.00, 15.00],
  'claude-3-5-sonnet-20241022':  [3.00, 15.00],
  'claude-3-5-sonnet-20240620':  [3.00, 15.00],
  'claude-3-5-haiku-20241022':   [0.80, 4.00],
  'claude-3-opus-20240229':      [15.00, 75.00],
  'claude-3-haiku-20240307':     [0.25, 1.25],
  // Google
  'gemini-2.5-pro':     [1.25, 10.00],
  'gemini-2.5-flash':   [0.15, 0.60],
  'gemini-2.0-flash':   [0.10, 0.40],
  'gemini-1.5-pro':     [1.25, 5.00],
  'gemini-1.5-flash':   [0.075, 0.30],
  // xAI
  'grok-3':             [3.00, 15.00],
  'grok-3-mini':        [0.30, 0.50],
  'grok-2':             [2.00, 10.00],
  // DeepSeek
  'deepseek-chat':      [0.27, 1.10],
  'deepseek-reasoner':  [0.55, 2.19],
};

/**
 * Find pricing for a model. Does fuzzy prefix matching.
 * Returns [inputPer1M, outputPer1M] or null if unknown.
 */
export function getModelPricing(modelId) {
  if (!modelId) return null;
  const lower = modelId.toLowerCase();

  // Exact match first
  if (PRICING[lower]) return PRICING[lower];

  // Prefix match (e.g. "gpt-4o-2024-08-06" matches "gpt-4o")
  const keys = Object.keys(PRICING).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (lower.startsWith(key) || lower.includes(key)) return PRICING[key];
  }

  return null;
}

/**
 * Calculate costs for a given token count and model.
 * Returns { inputCost, maxOutputCost, totalCost } in USD, or null if pricing unknown.
 */
export function calculateCost(inputTokens, maxOutputTokens, modelId) {
  const pricing = getModelPricing(modelId);
  if (!pricing) return null;
  const [inputPer1M, outputPer1M] = pricing;
  const inputCost = (inputTokens / 1_000_000) * inputPer1M;
  const maxOutputCost = (maxOutputTokens / 1_000_000) * outputPer1M;
  return {
    inputCost,
    maxOutputCost,
    totalCost: inputCost + maxOutputCost,
  };
}

/** Format a USD amount nicely */
export function formatCost(usd) {
  if (usd < 0.001) return '<$0.001';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
