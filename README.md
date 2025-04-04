# MCP Advisor

An MCP server that provides comprehensive access to the Model Context Protocol specification through both prompts and resources. This server helps LLMs and humans understand and work with the MCP specification by providing the complete JSON schema and detailed documentation.

## When would I use this type of solution instead of web search or other RAG solutions?

While the same information is already available on the web, if you have a use case where precise spec information is preferred, directly fetching the spec details as context should provide a more reliable result.

Since these resources should easily fit within a model's context window, using a more complex RAG solution is not really necessary unless you need to compare documents to other documents, or do more complex types of querying.

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
        "mcp-advisor@latest"
      ]
    }
  }
}
```

2. The server provides the following capabilities:

#### Prompts

- `explain`: Comprehensive explanation of MCP topics with full documentation context. Requires a `topic` argument specifying which MCP topic you would like explained in detail.

#### Resources

The server provides access to different sections of the MCP specification documentation:

- **Complete Specification** (`/specification/complete`): The complete Model Context Protocol specification including schema, architecture, base protocol, utilities, server features, and client features
- **Schema Specification** (`/specification/schema`): The complete Model Context Protocol JSON schema specification (2025-03-26)
- **Architecture Overview** (`/specification/basic/architecture`): Overview of the Model Context Protocol architecture
- **Base Protocol** (`/specification/basic`): Core protocol details including transports, authorization, and lifecycle
- **Utilities** (`/specification/utilities`): Documentation for Ping, Cancellation, and Progress Reporting features
- **Server Features** (`/specification/server`): Comprehensive guide to Prompts, Resources, Tools, and Server Utilities including completion, logging, and pagination
- **Client Features** (`/specification/client`): Information about Roots and Sampling capabilities

All specification content fetched from GitHub is cached locally with a 1-hour TTL (time-to-live) to improve performance and reduce API calls. If a fetch fails, the server will attempt to use expired cached content as a fallback when available.

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
