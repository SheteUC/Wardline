const http = require('node:http');
const { URL } = require('node:url');

const DEFAULT_PORT = Number(process.env.MOCK_INTEGRATION_PORT || 4010);
const DEFAULT_TOKEN = process.env.MOCK_ATHENAHEALTH_TOKEN || 'mock-athena-token';
const DEFAULT_DELAY_MS = Number(process.env.MOCK_INTEGRATION_TIMEOUT_MS || 5000);

function jsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(payload));
}

function parseScenario(pathname) {
  const match = pathname.match(/^\/scenario\/([^/]+)(\/.*)?$/);
  if (!match) {
    return {
      scenario: 'success',
      routePath: pathname,
    };
  }

  return {
    scenario: match[1] || 'success',
    routePath: match[2] || '/',
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function makeReference(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createMockIntegrationServer(options = {}) {
  const authToken = options.authToken || DEFAULT_TOKEN;
  const timeoutMs = Number(options.timeoutMs || DEFAULT_DELAY_MS);

  const server = http.createServer(async (req, res) => {
    if (!req.url || !req.method) {
      jsonResponse(res, 400, { error: 'invalid_request' });
      return;
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      res.end();
      return;
    }

    const url = new URL(req.url, 'http://localhost');
    const { scenario, routePath } = parseScenario(url.pathname);
    const authorization = req.headers.authorization || '';

    if (!authorization.startsWith('Bearer ') || authorization.slice(7) !== authToken) {
      jsonResponse(res, 401, {
        error: 'unauthorized',
        message: 'Missing or invalid bearer token.',
      });
      return;
    }

    if (scenario === 'timeout') {
      setTimeout(() => {
        jsonResponse(res, 200, {
          ok: true,
          scenario,
          delayed: true,
          id: makeReference('timeout'),
        });
      }, timeoutMs);
      return;
    }

    if (scenario === 'error') {
      jsonResponse(res, 500, {
        error: 'server_error',
        message: 'Mock integration forced an internal error.',
      });
      return;
    }

    if (scenario === 'unsupported') {
      jsonResponse(res, 501, {
        error: 'unsupported_operation',
        message: 'Mock integration does not support this operation.',
      });
      return;
    }

    if (req.method === 'GET' && routePath === '/metadata') {
      jsonResponse(res, 200, {
        ok: true,
        scenario,
        vendor: 'athenahealth',
        capabilities: {
          appointmentRequest: true,
          refillRequest: true,
          insuranceCheck: true,
          billingRequest: true,
        },
      });
      return;
    }

    if (req.method !== 'POST') {
      jsonResponse(res, 405, {
        error: 'method_not_allowed',
        message: `Unsupported method ${req.method}.`,
      });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      jsonResponse(res, 400, {
        error: 'invalid_json',
        message: 'Request body must be valid JSON.',
      });
      return;
    }

    if (routePath === '/appointments/request') {
      jsonResponse(res, 200, {
        id: makeReference('appt'),
        status: 'accepted',
        action: 'appointment-request',
        received: body,
      });
      return;
    }

    if (routePath === '/medication-refills') {
      jsonResponse(res, 200, {
        id: makeReference('refill'),
        status: 'accepted',
        action: 'refill-request',
        received: body,
      });
      return;
    }

    if (routePath === '/coverage/check') {
      jsonResponse(res, 200, {
        id: makeReference('coverage'),
        status: 'resolved',
        accepted: true,
        action: 'insurance-check',
        received: body,
      });
      return;
    }

    if (routePath === '/billing/cases') {
      jsonResponse(res, 200, {
        id: makeReference('billing'),
        status: 'accepted',
        action: 'billing-request',
        received: body,
      });
      return;
    }

    jsonResponse(res, 404, {
      error: 'not_found',
      message: `Unknown mock route: ${routePath}`,
    });
  });

  return {
    server,
    async start(port = DEFAULT_PORT) {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', resolve);
      });

      const address = server.address();
      const resolvedPort = typeof address === 'object' && address ? address.port : port;

      return {
        port: resolvedPort,
        baseUrl: `http://127.0.0.1:${resolvedPort}`,
        authToken,
      };
    },
    async stop() {
      if (!server.listening) return;
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve(undefined)));
      });
    },
  };
}

module.exports = {
  createMockIntegrationServer,
};

if (require.main === module) {
  const instance = createMockIntegrationServer();

  instance
    .start()
    .then(({ baseUrl, authToken }) => {
      console.log(`[mock-integrations] listening on ${baseUrl}`);
      console.log(`[mock-integrations] bearer token: ${authToken}`);
      console.log('[mock-integrations] success scenario health: /scenario/success/metadata');
      console.log('[mock-integrations] timeout scenario example: /scenario/timeout/appointments/request');
    })
    .catch((error) => {
      console.error('[mock-integrations] failed to start');
      console.error(error);
      process.exitCode = 1;
    });
}
