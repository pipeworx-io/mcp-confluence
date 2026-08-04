# mcp-confluence

Confluence MCP — wraps the Confluence Cloud REST API v2 (OAuth)

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `confluence_list_pages` | List all pages in a Confluence space. Returns page ID, title, status, and version. Specify space key (e.g., "ENG", "SALES"). |
| `confluence_get_page` | Get full content of a Confluence page by ID. Returns title, body content, status, version, and space info. |
| `confluence_search` | Search Confluence pages by keyword or CQL query. Returns matching pages with ID, title, space, and content excerpt. |
| `confluence_create_page` | Create a new Confluence page with title and content. Specify parent page ID or space key (e.g., "ENG"). Returns page ID and URL. |
| `confluence_list_spaces` | List all Confluence spaces in your instance. Returns space ID, key, name, type, and status. Use to discover documentation areas. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "confluence": {
      "url": "https://gateway.pipeworx.io/confluence/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Confluence data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
