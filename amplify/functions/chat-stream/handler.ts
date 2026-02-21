// Streaming Lambda handler — invoked via API Gateway REST API with ResponseTransferMode: STREAM.
// Auth is handled by the Cognito User Pools authorizer on API Gateway.
// The in-code role check below is defense-in-depth.

declare const awslambda: {
  streamifyResponse: (handler: any) => any;
  HttpResponseStream: {
    from: (stream: any, metadata: any) => any;
  };
};

/** Decode JWT payload and check for a role in the `roles` or `custom:roles` claim. */
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
    // ── Role check: verify chatUser role from Cognito/OIDC token ──
    const authHeader = event.headers?.['authorization'] || event.headers?.['Authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token || !hasRequiredRole(token, 'chatUser')) {
      const errStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
      });
      errStream.write(JSON.stringify({ error: 'Invalid JSON body' }));
      errStream.end();
      return;
    }

    const { endpoint, apiKey, messages, model, max_tokens, temperature, mcp_servers } = body;

    if (!endpoint || !apiKey) {
      const errStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
      });
      errStream.write(JSON.stringify({ error: 'Missing endpoint or apiKey' }));
      errStream.end();
      return;
    }

    try {
      const apiRes = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens,
          temperature,
          stream: true,
          ...(mcp_servers && mcp_servers.length > 0 ? { mcp_servers } : {}),
        }),
      });

      if (!apiRes.ok) {
        const errText = await apiRes.text();
        const errStream = awslambda.HttpResponseStream.from(responseStream, {
          statusCode: apiRes.status,
          headers: { 'Content-Type': 'application/json' },
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
        },
      });

      const reader = apiRes.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        outStream.write(decoder.decode(value, { stream: true }));
      }

      outStream.end();
    } catch (err: any) {
      console.error('Stream proxy error:', err);
      const errStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      errStream.write(JSON.stringify({ error: err.message || 'Internal error' }));
      errStream.end();
    }
  }
);
