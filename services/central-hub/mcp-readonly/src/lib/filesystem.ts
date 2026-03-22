import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

export const PROJECT_ROOT = '/root/leadmaster-workspace';
export const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);
export const MAX_FILE_CHARS = 50000;
export const MAX_SEARCH_MATCHES = 100;

export const listRepoTreeArgsSchema = z.object({
  path: z.string().trim().min(1).optional(),
});

export const readFileArgsSchema = z.object({
  path: z.string().trim().min(1),
});

export const searchInRepoArgsSchema = z.object({
  query: z.string().trim().min(1),
  path: z.string().trim().min(1).optional(),
});

export type SearchMatch = {
  path: string;
  line: number;
  column: number;
  preview: string;
};

export function normalizeRelativePath(inputPath?: string): string {
  if (!inputPath || inputPath === '.') {
    return '';
  }

  const normalized = inputPath.replaceAll('\\', '/').replace(/^\/+/, '');
  return path.posix.normalize(normalized);
}

export function resolveProjectPath(inputPath?: string): string {
  const relativePath = normalizeRelativePath(inputPath);
  const resolvedPath = path.resolve(PROJECT_ROOT, relativePath);
  const relativeToRoot = path.relative(PROJECT_ROOT, resolvedPath);

  if (
    relativeToRoot === '..' ||
    relativeToRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToRoot)
  ) {
    throw new McpError(ErrorCode.InvalidParams, 'Path fuera de PROJECT_ROOT');
  }

  return resolvedPath;
}

export function toRepoRelativePath(absolutePath: string): string {
  return path.relative(PROJECT_ROOT, absolutePath).split(path.sep).join('/');
}

export function isExcludedPath(absolutePath: string): boolean {
  const relativePath = toRepoRelativePath(absolutePath);

  if (!relativePath) {
    return false;
  }

  return relativePath.split('/').some((segment) => EXCLUDED_DIRS.has(segment));
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatTextResult(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

export async function listRepoTree(inputPath?: string) {
  const targetPath = resolveProjectPath(inputPath);

  if (isExcludedPath(targetPath)) {
    throw new McpError(ErrorCode.InvalidParams, 'Path excluido');
  }

  const targetStats = await stat(targetPath).catch(() => {
    throw new McpError(ErrorCode.InvalidParams, 'Path inexistente');
  });

  if (!targetStats.isDirectory()) {
    throw new McpError(ErrorCode.InvalidParams, 'Path debe ser un directorio');
  }

  async function walk(currentPath: string): Promise<string[]> {
    const entries = await readdir(currentPath, { withFileTypes: true });
    const visibleEntries = entries
      .filter((entry) => !EXCLUDED_DIRS.has(entry.name))
      .sort((left, right) => left.name.localeCompare(right.name, 'es'));

    const lines: string[] = [];

    for (const entry of visibleEntries) {
      const entryPath = path.join(currentPath, entry.name);
      const relativePath = toRepoRelativePath(entryPath);

      if (entry.isDirectory()) {
        lines.push(`${relativePath}/`);
        const childLines = await walk(entryPath);
        lines.push(...childLines);
        continue;
      }

      if (entry.isFile()) {
        lines.push(relativePath);
      }
    }

    return lines;
  }

  const tree = await walk(targetPath);
  const baseRelativePath = normalizeRelativePath(inputPath) || '.';

  return {
    root: baseRelativePath,
    entries: tree,
  };
}

export async function readProjectFile(inputPath: string) {
  const targetPath = resolveProjectPath(inputPath);

  if (isExcludedPath(targetPath)) {
    throw new McpError(ErrorCode.InvalidParams, 'Path excluido');
  }

  const fileStats = await stat(targetPath).catch(() => {
    throw new McpError(ErrorCode.InvalidParams, 'Archivo inexistente');
  });

  if (!fileStats.isFile()) {
    throw new McpError(ErrorCode.InvalidParams, 'Path debe ser un archivo');
  }

  const content = await readFile(targetPath, 'utf8');
  const truncated = content.length > MAX_FILE_CHARS;

  return {
    path: toRepoRelativePath(targetPath),
    content: truncated ? `${content.slice(0, MAX_FILE_CHARS)}\n[truncado]` : content,
  };
}

export async function searchInRepo(query: string, inputPath?: string) {
  const rootPath = resolveProjectPath(inputPath);

  if (isExcludedPath(rootPath)) {
    throw new McpError(ErrorCode.InvalidParams, 'Path excluido');
  }

  const rootStats = await stat(rootPath).catch(() => {
    throw new McpError(ErrorCode.InvalidParams, 'Path inexistente');
  });

  const searchRoot = rootStats.isDirectory() ? rootPath : path.dirname(rootPath);
  const fileFilter = rootStats.isFile() ? rootPath : null;
  const matcher = new RegExp(escapeRegExp(query), 'gi');
  const matches: SearchMatch[] = [];

  async function walk(currentPath: string): Promise<void> {
    if (matches.length >= MAX_SEARCH_MATCHES) {
      return;
    }

    if (fileFilter && currentPath !== fileFilter && !currentPath.startsWith(`${fileFilter}${path.sep}`)) {
      const currentStats = await stat(currentPath);

      if (currentStats.isFile()) {
        return;
      }
    }

    const currentStats = await stat(currentPath);

    if (currentStats.isDirectory()) {
      const entries = await readdir(currentPath, { withFileTypes: true });
      const visibleEntries = entries
        .filter((entry) => !EXCLUDED_DIRS.has(entry.name))
        .sort((left, right) => left.name.localeCompare(right.name, 'es'));

      for (const entry of visibleEntries) {
        if (matches.length >= MAX_SEARCH_MATCHES) {
          return;
        }

        await walk(path.join(currentPath, entry.name));
      }

      return;
    }

    if (!currentStats.isFile()) {
      return;
    }

    if (isExcludedPath(currentPath)) {
      return;
    }

    if (fileFilter && currentPath !== fileFilter) {
      return;
    }

    const content = await readFile(currentPath, 'utf8').catch(() => '');

    if (!content) {
      return;
    }

    const lines = content.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      if (matches.length >= MAX_SEARCH_MATCHES) {
        return;
      }

      const line = lines[index];
      matcher.lastIndex = 0;

      let match = matcher.exec(line);
      while (match) {
        matches.push({
          path: toRepoRelativePath(currentPath),
          line: index + 1,
          column: match.index + 1,
          preview: line,
        });

        if (matches.length >= MAX_SEARCH_MATCHES) {
          return;
        }

        match = matcher.exec(line);
      }
    }
  }

  await walk(searchRoot);

  return {
    root: normalizeRelativePath(inputPath) || '.',
    query,
    totalMatches: matches.length,
    matches,
  };
}

export const readonlyToolDefinitions = [
  {
    name: 'list_repo_tree',
    description: 'Lista el arbol del repositorio dentro de PROJECT_ROOT.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path relativo opcional dentro de /root/leadmaster-workspace',
        },
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'read_file',
    description: 'Lee un archivo dentro de PROJECT_ROOT en modo solo lectura.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path relativo al archivo dentro de /root/leadmaster-workspace',
        },
      },
      required: ['path'],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'search_in_repo',
    description: 'Busca texto dentro del repositorio de forma case-insensitive.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Texto a buscar',
        },
        path: {
          type: 'string',
          description: 'Path relativo opcional para acotar la busqueda',
        },
      },
      required: ['query'],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
] as const;