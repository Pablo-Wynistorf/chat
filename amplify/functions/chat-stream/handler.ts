// Streaming Lambda handler — invoked via API Gateway REST API with ResponseTransferMode: STREAM.
// Adapts requests to Anthropic, Google Gemini, OpenAI, and any OpenAI-compatible API.
// Always returns OpenAI-compatible SSE format to the frontend.

import {
  detectProvider,
  buildHeaders,
  buildChatUrl,
  buildChatBody,
  normalizeSSELine,
} from '../shared/providers';

declare const awslambda: {
  streamifyResponse: (handler: any) => any;
  HttpResponseStream: {
    from: (stream: any, metadata: any) => any;
  };
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

/** Decode JWT payload and check for a role claim. */
function hasRequiredRole(jwt: string, role: string): boolean {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const roles = payload['roles'] || payload['custom:roles'] || '';
    if (Array.isArray(roles)) return roles.includes(role);
    if (typeof roles === 'string') {
      try {
        const parsed = JSON.parse(roles);
        if (Array.isArray(parsed)) return parsed.includes(role);
      } catch { /* comma-separated fallback */ }
      return roles.split(',').map((r: string) => r.trim()).includes(role);
    }
    return false;
  } catch {
    return false;
  }
}

export const handler = awslambda.streamifyResponse(
  async (event: any, responseStream: any, _context: any) => {
    // Handle CORS preflight (belt-and-suspenders alongside API GW OPTIONS)
    if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
      const s = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 200,
        headers: { ...CORS_HEADERS },
      });
      s.write('');
      s.end();
      return;
    }

    const authHeader = event.headers?.['authorization'] || event.headers?.['Authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token || !hasRequiredRole(token, 'chatUser')) {
      const errStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
      errStream.write(JSON.stringify({ error: 'Forbidden: missing chatUser role' }));
      errStream.end();
      return;
    }

    let body: any;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      const errStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
      errStream.write(JSON.stringify({ error: 'Invalid JSON body' }));
      errStream.end();
      return;
    }

    const { endpoint, apiKey, messages, model, max_tokens, temperature, mcp_servers } = body;

    if (!endpoint || !apiKey) {
      const errStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
      errStream.write(JSON.stringify({ error: 'Missing endpoint or apiKey' }));
      errStream.end();
      return;
    }

    const provider = detectProvider(endpoint);

    try {
      const chatUrl = buildChatUrl(provider, endpoint, model, apiKey);
      const chatHeaders = buildHeaders(provider, apiKey);
      const chatBody = buildChatBody(provider, {
        model,
        messages,
        max_tokens,
        temperature,
        stream: true,
        mcp_servers,
      });

      const apiRes = await fetch(chatUrl, {
        method: 'POST',
        headers: chatHeaders,
        body: JSON.stringify(chatBody),
      });

      if (!apiRes.ok) {
        const errText = await apiRes.text();
        const errStream = awslambda.HttpResponseStream.from(responseStream, {
          statusCode: apiRes.status,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
        errStream.write(errText);
        errStream.end();
        return;
      }

      const outStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          ...CORS_HEADERS,
        },
      });

      // For OpenAI-compatible providers, pass through raw SSE (already correct format)
      if (provider === 'openai-compat') {
        const reader = apiRes.body!.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          outStream.write(decoder.decode(value, { stream: true }));
        }
      } else {
        // For Anthropic/Google, parse SSE lines and normalize to OpenAI format
        const reader = apiRes.body!.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split('\n');
          sseBuffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data) continue;
            const normalized = normalizeSSELine(provider, data);
            if (normalized) outStream.write(normalized + '\n\n');
          }
        }
      }

      outStream.end();
    } catch (err: any) {
      console.error('Stream proxy error:', err);
      const errStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
      errStream.write(JSON.stringify({ error: err.message || 'Internal error' }));
      errStream.end();
    }
  }
);
