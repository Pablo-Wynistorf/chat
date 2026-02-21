// Non-streaming proxy handler (fetchModels, non-streaming chat)
// Adapts requests to Anthropic, Google Gemini, OpenAI, and any OpenAI-compatible API.
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import {
  detectProvider,
  buildModelsUrl,
  buildModelsHeaders,
  normalizeModelsResponse,
  buildHeaders,
  buildChatUrl,
  buildChatBody,
} from '../shared/providers';

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

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  if (event.requestContext.http.method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  const authHeader = event.headers?.['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token || !hasRequiredRole(token, 'chatUser')) {
    return respond(403, { error: 'Forbidden: missing chatUser role' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { endpoint, apiKey } = body;

    if (!endpoint || !apiKey) {
      return respond(400, { error: 'Missing endpoint or apiKey' });
    }

    const provider = detectProvider(endpoint);

    // Fetch models list
    if (body.action === 'fetchModels') {
      const url = buildModelsUrl(provider, endpoint, apiKey);
      const headers = buildModelsHeaders(provider, apiKey);
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const errText = await res.text();
        return respond(res.status, { error: errText || 'Failed to fetch models' });
      }
      const json = await res.json();
      return respond(200, normalizeModelsResponse(provider, json));
    }

    // Non-streaming chat completion
    const chatUrl = buildChatUrl(provider, endpoint, body.model, apiKey);
    const chatHeaders = buildHeaders(provider, apiKey);
    const chatBody = buildChatBody(provider, {
      model: body.model,
      messages: body.messages,
      max_tokens: body.max_tokens,
      temperature: body.temperature,
      stream: false,
    });

    const apiRes = await fetch(chatUrl, {
      method: 'POST',
      headers: chatHeaders,
      body: JSON.stringify(chatBody),
    });

    if (!apiRes.ok) {
      const err = await apiRes.text();
      return respond(apiRes.status, { error: err });
    }

    const json = await apiRes.json();
    return respond(200, json);
  } catch (err: any) {
    console.error('Chat proxy error:', err);
    return respond(500, { error: err.message || 'Internal server error' });
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };
}

function respond(statusCode: number, body: any) {
  return {
    statusCode,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
