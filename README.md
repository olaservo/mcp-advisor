# MCP Advisor

An MCP server that provides comprehensive access to the Model Context Protocol specification through both prompts and resources. This server helps LLMs and humans understand and work with the MCP specification by providing the complete JSON schema and detailed documentation.

## When would I use this type of solution instead of web search or other RAG solutions?

While the same information is already available on the web, if you have a use case where precise spec information is preferred, directly fetching the spec details as context should provide a more reliable result.

Since these resources should easily fit within a model's context window, using a more complex RAG solution is not really necessary unless you need to compare documents to other documents, or do more complex types of querying.

## Other ways to do the same thing

If you prefer a more ad-hoc approach you can also use an MCP server like [fetch](https://github.com/modelcontextprotocol/servers/tree/main/src/fetch) to do the following:

1. Fetch the contents of https://modelcontextprotocol.io/llms.txt to get the list of valid links
2. Fetch content from links that are relevant to the current task


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
- `evaluate_server_compliance`: Evaluates Model Context Protocol (MCP) specification compliance for a given server repository. Requires a `path` argument specifying the path to the MCP server repository to evaluate.

#### Resources

The server provides access to different sections of the MCP specification and documentation:

**Specification Resources**
- **Complete Specification** (`/specification/complete`): The complete Model Context Protocol specification including schema, architecture, base protocol, utilities, server features, and client features
- **Schema Specification** (`/specification/schema`): The complete Model Context Protocol JSON schema specification (2025-03-26)
- **Architecture Overview** (`/specification/basic/architecture`): Overview of the Model Context Protocol architecture
- **Base Protocol** (`/specification/basic`): Core protocol details including transports, authorization, and lifecycle
- **Utilities** (`/specification/utilities`): Documentation for Ping, Cancellation, and Progress Reporting features
- **Server Features** (`/specification/server`): Comprehensive guide to Prompts, Resources, Tools, and Server Utilities including completion, logging, and pagination
- **Client Features** (`/specification/client`): Information about Roots and Sampling capabilities

**Additional Documentation**
- **Getting Started** (`/quickstart`): Getting started guides for client developers, server developers, and users
- **Development** (`/development`): Development resources including contributing guidelines, roadmap, and updates
- **SDK Documentation** (`/sdk`): SDK documentation for various programming languages
- **Tutorials & Examples** (`/tutorials`): Tutorials, examples, and implementation guides
- **General Documentation** (`/docs`): General documentation including FAQs, introduction, and client list

All specification content is fetched from a list provided by [a standardized llms.txt file](https://llmstxt.org/) (except for the schema.json which is fetched from GitHub) and cached locally with a 1-hour TTL (time-to-live) to improve performance. If a fetch fails, the server will attempt to use expired cached content as a fallback when available.

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

### Testing URL Filtering

The server includes URL filtering to ensure only content matching the current version is included:

```bash
npm run test:urls
```

This verifies that the server correctly filters specification URLs based on the VERSION constant.  Note that "draft" is treated the same as any other version, which means it should be explicitly specified if you want to point to the "draft" version of the spec and documentation.

## Links

- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/specification/2025-03-26/)
