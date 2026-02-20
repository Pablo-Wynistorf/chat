// Streaming Lambda handler — invoked via Function URL with RESPONSE_STREAM mode.
// Uses the awslambda.streamifyResponse global provided by the Lambda runtime.

declare const awslambda: {
  streamifyResponse: (handler: any) => any;
  HttpResponseStream: {
    from: (stream: any, metadata: any) => any;
  };
};

export const handler = awslambda.streamifyResponse(
  async (event: any, responseStream: any, _context: any) => {
    let body: any;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      const errStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 400,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
      errStream.write(JSON.stringify({ error: 'Invalid JSON body' }));
      errStream.end();
      return;
    }

    const { endpoint, apiKey, messages, model, max_tokens, temperature } = body;

    if (!endpoint || !apiKey) {
      const errStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 400,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
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
        }),
      });

      if (!apiRes.ok) {
        const errText = await apiRes.text();
        const errStream = awslambda.HttpResponseStream.from(responseStream, {
          statusCode: apiRes.status,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        });
        errStream.write(errText);
        errStream.end();
        return;
      }

      // Stream SSE data through to the client
      const outStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 200,
        headers: {
          ...corsHeaders(),
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
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
      errStream.write(JSON.stringify({ error: err.message || 'Internal error' }));
      errStream.end();
    }
  }
);

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };
}
