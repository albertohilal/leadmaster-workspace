import { randomUUID } from 'node:crypto';

import type { Request, Response } from 'express';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

import { createReadonlyServer } from './lib/server.js';

type SessionState = {
  server: ReturnType<typeof createReadonlyServer>;
  transport: StreamableHTTPServerTransport;
};

const DEFAULT_ALLOWED_HOSTS = [
  'localhost',
  '127.0.0.1',
  'mcp.desarrolloydisenioweb.com.ar',
];

function getPort(): number {
  const parsed = Number.parseInt(process.env.PORT ?? '3011', 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return 3011;
  }

  return parsed;
}

function getAllowedHosts(): string[] {
  const envHosts = (process.env.ALLOWED_HOSTS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.replace(/^https?:\/\//, ''))
    .map((value) => value.replace(/:\d+$/, ''));

  return [...new Set([...DEFAULT_ALLOWED_HOSTS, ...envHosts])];
}

function getSessionId(headerValue: string | string[] | undefined): string | undefined {
  if (Array.isArray(headerValue)) {
    return headerValue[0];
  }

  return headerValue;
}

function sendBadRequest(res: Response, message: string) {
  res.status(400).json({
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message,
    },
    id: null,
  });
}

async function main() {
  const port = getPort();
  const allowedHosts = getAllowedHosts();
  const app = createMcpExpressApp({
    allowedHosts,
  });
  const sessions = new Map<string, SessionState>();

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.post('/mcp', async (req: Request, res: Response) => {
    const sessionId = getSessionId(req.headers['mcp-session-id']);

    try {
      if (sessionId) {
        const existingSession = sessions.get(sessionId);

        if (!existingSession) {
          sendBadRequest(res, 'Bad Request: Invalid session ID');
          return;
        }

        await existingSession.transport.handleRequest(req, res, req.body);
        return;
      }

      if (!isInitializeRequest(req.body)) {
        sendBadRequest(res, 'Bad Request: No valid session ID provided');
        return;
      }

      const server = createReadonlyServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (initializedSessionId) => {
          sessions.set(initializedSessionId, { server, transport });
        },
      });

      transport.onclose = () => {
        const initializedSessionId = transport.sessionId;

        if (initializedSessionId) {
          sessions.delete(initializedSessionId);
        }
      };

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('HTTP MCP error:', error);

      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  });

  app.get('/mcp', async (req: Request, res: Response) => {
    const sessionId = getSessionId(req.headers['mcp-session-id']);

    if (!sessionId) {
      sendBadRequest(res, 'Bad Request: Missing session ID');
      return;
    }

    const existingSession = sessions.get(sessionId);

    if (!existingSession) {
      sendBadRequest(res, 'Bad Request: Invalid session ID');
      return;
    }

    try {
      await existingSession.transport.handleRequest(req, res);
    } catch (error) {
      console.error('HTTP MCP SSE error:', error);

      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }
    }
  });

  app.delete('/mcp', async (req: Request, res: Response) => {
    const sessionId = getSessionId(req.headers['mcp-session-id']);

    if (!sessionId) {
      sendBadRequest(res, 'Bad Request: Missing session ID');
      return;
    }

    const existingSession = sessions.get(sessionId);

    if (!existingSession) {
      sendBadRequest(res, 'Bad Request: Invalid session ID');
      return;
    }

    try {
      await existingSession.transport.handleRequest(req, res);
    } catch (error) {
      console.error('HTTP MCP session close error:', error);

      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }
    }
  });

  app.listen(port, () => {
    console.log(`HTTP MCP server listening on port ${port}`);
    console.log(`MCP endpoint: http://localhost:${port}/mcp`);
    console.log(`Health endpoint: http://localhost:${port}/health`);
    console.log(`Allowed hosts: ${allowedHosts.join(', ')}`);
  });
}

main().catch((error) => {
  console.error('HTTP MCP bootstrap error:', error);
  process.exit(1);
});