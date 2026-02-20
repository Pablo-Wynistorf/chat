// This handler is used for non-streaming requests (fetchModels)
// via the HTTP API Gateway route.
// Streaming chat is handled by the streaming Lambda (chat-stream).
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  if (event.requestContext.http.method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { endpoint, apiKey } = body;

    if (!endpoint || !apiKey) {
      return respond(400, { error: 'Missing endpoint or apiKey' });
    }

    // Fetch models list
    if (body.action === 'fetchModels') {
      const res = await fetch(`${endpoint}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) return respond(res.status, { error: 'Failed to fetch models' });
      const json = await res.json();
      return respond(200, json);
    }

    // Non-streaming chat completion
    const apiRes = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: body.model,
        messages: body.messages,
        max_tokens: body.max_tokens,
        temperature: body.temperature,
        stream: false,
      }),
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
