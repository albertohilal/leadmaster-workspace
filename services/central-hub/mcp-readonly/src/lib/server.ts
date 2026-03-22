import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import {
  formatTextResult,
  listRepoTree,
  listRepoTreeArgsSchema,
  readFileArgsSchema,
  readProjectFile,
  readonlyToolDefinitions,
  searchInRepo,
  searchInRepoArgsSchema,
} from './filesystem.js';

export function createReadonlyServer() {
  const server = new Server(
    {
      name: 'mcp-readonly',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
      instructions:
        'Servidor MCP read-only sobre /root/leadmaster-workspace. Solo expone list_repo_tree, read_file y search_in_repo.',
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...readonlyToolDefinitions],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const rawArguments = request.params.arguments ?? {};

    switch (toolName) {
      case 'list_repo_tree': {
        const args = listRepoTreeArgsSchema.parse(rawArguments);
        return formatTextResult(await listRepoTree(args.path));
      }

      case 'read_file': {
        const args = readFileArgsSchema.parse(rawArguments);
        return formatTextResult(await readProjectFile(args.path));
      }

      case 'search_in_repo': {
        const args = searchInRepoArgsSchema.parse(rawArguments);
        return formatTextResult(await searchInRepo(args.query, args.path));
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Tool desconocida: ${toolName}`);
    }
  });

  return server;
}