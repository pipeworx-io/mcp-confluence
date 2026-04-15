interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Confluence MCP — wraps the Confluence Cloud REST API v2 (OAuth)
 *
 * Tools:
 * - confluence_list_pages: list pages in a space
 * - confluence_get_page: get a single page by ID
 * - confluence_search: search content with CQL
 * - confluence_create_page: create a new page
 * - confluence_list_spaces: list all spaces
 */


interface ConfluenceContext {
  confluence?: { accessToken: string; cloudId: string };
}

function baseUrl(cloudId: string): string {
  return `https://api.atlassian.com/ex/confluence/${cloudId}/wiki/api/v2`;
}

// ── Tool definitions ──────────────────────────────────────────────────

const tools: McpToolExport['tools'] = [
  {
    name: 'confluence_list_pages',
    description:
      'List pages in a Confluence space. Returns page ID, title, status, and version.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        space_id: { type: 'string', description: 'Space ID to list pages from' },
        limit: {
          type: 'number',
          description: 'Number of pages to return (default 25, max 100)',
        },
        sort: {
          type: 'string',
          description: 'Sort order: "created-date", "-created-date", "modified-date", "-modified-date", "title" (default: "-modified-date")',
        },
      },
      required: ['space_id'],
    },
  },
  {
    name: 'confluence_get_page',
    description:
      'Get a single Confluence page by ID. Returns page title, body content, status, version, and space info.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        page_id: { type: 'string', description: 'Page ID' },
        body_format: {
          type: 'string',
          description: 'Body format to return: "storage" (HTML) or "atlas_doc_format" (ADF). Default: "storage"',
        },
      },
      required: ['page_id'],
    },
  },
  {
    name: 'confluence_search',
    description:
      'Search Confluence content using CQL (Confluence Query Language). Returns matching pages with ID, title, space, and excerpt.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        cql: {
          type: 'string',
          description: 'CQL query string (e.g., "text ~ \\"search term\\"", "space = DEV AND type = page")',
        },
        limit: {
          type: 'number',
          description: 'Number of results to return (default 25, max 100)',
        },
      },
      required: ['cql'],
    },
  },
  {
    name: 'confluence_create_page',
    description:
      'Create a new Confluence page. Returns the created page ID, title, and URL.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        spaceId: { type: 'string', description: 'Space ID to create the page in' },
        title: { type: 'string', description: 'Page title' },
        body: { type: 'string', description: 'Page body content in Confluence storage format (XHTML)' },
        parentId: { type: 'string', description: 'Parent page ID (optional, for nesting)' },
        status: {
          type: 'string',
          description: 'Page status: "current" (published) or "draft". Default: "current"',
        },
      },
      required: ['spaceId', 'title', 'body'],
    },
  },
  {
    name: 'confluence_list_spaces',
    description:
      'List all Confluence spaces. Returns space ID, key, name, type, and status.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Number of spaces to return (default 25, max 100)',
        },
        type: {
          type: 'string',
          description: 'Filter by space type: "global" or "personal"',
        },
      },
    },
  },
];

// ── Helpers ───────────────────────────────────────────────────────────

function getAuth(args: Record<string, unknown>): { token: string; cloudId: string } {
  const context = (args._context ?? {}) as ConfluenceContext;
  const token = context.confluence?.accessToken;
  const cloudId = context.confluence?.cloudId;
  if (!token || !cloudId) {
    throw new Error('Confluence OAuth token and cloudId required. Connect Confluence via OAuth first.');
  }
  return { token, cloudId };
}

async function confluenceGet(
  token: string,
  url: string,
  params?: Record<string, string>,
): Promise<unknown> {
  const qs = params ? `?${new URLSearchParams(params)}` : '';
  const res = await fetch(`${url}${qs}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Confluence API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function confluencePost(
  token: string,
  url: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Confluence API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Tool implementations ─────────────────────────────────────────────

async function listPages(token: string, cloudId: string, spaceId: string, limit?: number, sort?: string) {
  const count = Math.min(100, Math.max(1, limit ?? 25));
  const params: Record<string, string> = {
    limit: String(count),
  };
  if (sort) params.sort = sort;

  const data = (await confluenceGet(
    token,
    `${baseUrl(cloudId)}/spaces/${encodeURIComponent(spaceId)}/pages`,
    params,
  )) as { results: unknown[] };
  return { pages: data.results };
}

async function getPage(token: string, cloudId: string, pageId: string, bodyFormat?: string) {
  const format = bodyFormat ?? 'storage';
  const params: Record<string, string> = {
    'body-format': format,
  };
  return confluenceGet(
    token,
    `${baseUrl(cloudId)}/pages/${encodeURIComponent(pageId)}`,
    params,
  );
}

async function search(token: string, cloudId: string, cql: string, limit?: number) {
  const count = Math.min(100, Math.max(1, limit ?? 25));
  // Search uses the v1 API endpoint which supports CQL
  const searchUrl = `https://api.atlassian.com/ex/confluence/${cloudId}/wiki/rest/api/search`;
  const params: Record<string, string> = {
    cql,
    limit: String(count),
  };
  const data = (await confluenceGet(token, searchUrl, params)) as {
    results: {
      content?: { id: string; title: string; type: string; status: string };
      excerpt?: string;
      resultGlobalContainer?: { title: string };
    }[];
    totalSize: number;
  };
  return {
    total: data.totalSize,
    results: data.results.map((r) => ({
      id: r.content?.id ?? null,
      title: r.content?.title ?? null,
      type: r.content?.type ?? null,
      status: r.content?.status ?? null,
      space: r.resultGlobalContainer?.title ?? null,
      excerpt: r.excerpt ?? null,
    })),
  };
}

async function createPage(
  token: string,
  cloudId: string,
  spaceId: string,
  title: string,
  body: string,
  parentId?: string,
  status?: string,
) {
  const payload: Record<string, unknown> = {
    spaceId,
    title,
    status: status ?? 'current',
    body: {
      representation: 'storage',
      value: body,
    },
  };
  if (parentId) payload.parentId = parentId;

  return confluencePost(token, `${baseUrl(cloudId)}/pages`, payload);
}

async function listSpaces(token: string, cloudId: string, limit?: number, type?: string) {
  const count = Math.min(100, Math.max(1, limit ?? 25));
  const params: Record<string, string> = {
    limit: String(count),
  };
  if (type) params.type = type;

  const data = (await confluenceGet(token, `${baseUrl(cloudId)}/spaces`, params)) as {
    results: unknown[];
  };
  return { spaces: data.results };
}

// ── callTool dispatcher ──────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const { token, cloudId } = getAuth(args);
  delete args._context;

  switch (name) {
    case 'confluence_list_pages':
      return listPages(
        token,
        cloudId,
        args.space_id as string,
        args.limit as number | undefined,
        args.sort as string | undefined,
      );
    case 'confluence_get_page':
      return getPage(
        token,
        cloudId,
        args.page_id as string,
        args.body_format as string | undefined,
      );
    case 'confluence_search':
      return search(token, cloudId, args.cql as string, args.limit as number | undefined);
    case 'confluence_create_page':
      return createPage(
        token,
        cloudId,
        args.spaceId as string,
        args.title as string,
        args.body as string,
        args.parentId as string | undefined,
        args.status as string | undefined,
      );
    case 'confluence_list_spaces':
      return listSpaces(token, cloudId, args.limit as number | undefined, args.type as string | undefined);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default { tools, callTool, meter: { credits: 10 }, provider: 'confluence' } satisfies McpToolExport;
