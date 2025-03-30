# MCP Advisor

An MCP server that provides comprehensive access to the Model Context Protocol specification through both prompts and resources. This server helps LLMs and humans understand and work with the MCP specification by providing the complete JSON schema and detailed documentation.

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
