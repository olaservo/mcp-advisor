# MCP Advisor

An MCP server that provides the complete Model Context Protocol JSON schema specification for reference. This server helps LLMs and humans understand and work with the MCP specification.

## Installation

```bash
# Install as a dependency
npm install mcp-advisor

# Or install globally to use the CLI
npm install -g mcp-advisor
```

## Usage

### With Claude Desktop

1. Add the following to your Claude Desktop configuration file:

```json
{
  "mcpServers": {
    "mcp-advisor": {
      "command": "npx",
      "args": [
        "mcp-advisor"
      ]
    }
  }
}
```

2. The server provides a prompt named `mcp-spec-latest` that returns the complete MCP JSON schema specification.

### Development

```bash
# Clone the repository
git clone https://github.com/olaservo/mcp-advisor.git
cd mcp-advisor

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build the project
npm run build

# Start the built server
npm start
```

## Links

- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/specification/2025-03-26/)
- [FastMCP Documentation](https://github.com/punkpeye/fastmcp)

