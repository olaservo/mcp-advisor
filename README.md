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

- `mcp-spec-latest`: Returns the complete MCP JSON schema specification (2025-03-26)

#### Resources

The server provides access to different sections of the MCP specification documentation:

- **Architecture Overview**: Basic architectural concepts and design principles
- **Base Protocol**: Core protocol details including transports, authorization, and lifecycle
- **Utilities**: Documentation for Ping, Cancellation, and Progress Reporting features
- **Server Features**: Comprehensive guide to Prompts, Resources, Tools, and Server Utilities
- **Client Features**: Information about Roots and Sampling capabilities

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
