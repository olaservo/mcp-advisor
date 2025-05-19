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
        "-y",
        "mcp-advisor@latest"
      ],
      "env": {
        "DEFAULT_SPEC_VERSION":"2025-03-26" // Optional - overrides the default version used for static Resources that correspond to a specific MCP version
      }
    }
  }
}
```

2. The server provides the following capabilities:

#### Prompts

- `explain`: Comprehensive explanation of MCP topics with full documentation context. 
  - Required argument: `topic` - Specifies which MCP topic you would like explained in detail.
  - Optional argument: `version` - Specifies which MCP specification version to use. Supported versions: `draft`, `2024-11-05`, `2025-03-26` (default).
- `evaluate_server_compliance`: Evaluates Model Context Protocol (MCP) specification compliance for a given server repository. 
  - Required argument: `path` - Specifies the path to the MCP server repository to evaluate.
  - Optional argument: `version` - Specifies which MCP specification version to use. Supported versions: `draft`, `2024-11-05`, `2025-03-26` (default).

#### Resources

The server provides access to different sections of the MCP specification and documentation:

**Specification Resources**
- **Complete Specification**: The complete Model Context Protocol specification including schema, architecture, base protocol, utilities, server features, and client features
- **Schema Specification**: The complete Model Context Protocol JSON schema specification
- **Architecture Overview**: Overview of the Model Context Protocol architecture
- **Base Protocol**: Core protocol details including transports, authorization, and lifecycle
- **Utilities**: Documentation for Ping, Cancellation, and Progress Reporting features
- **Server Features**: Comprehensive guide to Prompts, Resources, Tools, and Server Utilities including completion, logging, and pagination
- **Client Features**: Information about Roots and Sampling capabilities

All specification resources can be accessed with a specific version parameter.

#### Resource Templates

The server provides resource templates that allow accessing specification resources for different versions:

- `https://modelcontextprotocol.io/specification/{version}/index.md`: Access the complete specification for any supported version
- `https://modelcontextprotocol.io/specification/{version}/schema.json`: Access the JSON schema for any supported version
- `https://modelcontextprotocol.io/specification/{version}/architecture/index.md`: Access the architecture specification for any supported version
- And more...

Supported versions: `draft`, `2024-11-05`, `2025-03-26` (default)

**Version Configuration**:
- **Resource Templates**: Clients that support Resource Templates can specify the version in the URI template.
- **Environment Variable**: Set the `DEFAULT_SPEC_VERSION` environment variable to change the default version (e.g., `DEFAULT_SPEC_VERSION=draft`).
- **Default Version**: If neither of the above is specified, the server uses `2025-03-26` as the default version.

**Note on Backward Compatibility**: Clients that only support Resources (and not Resource Templates) will still be able to access the regular Resources using the configured default version. The server maintains full backward compatibility with existing clients.

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

### Testing URL Filtering and Version Support

The server includes URL filtering to ensure content matching the requested version is included:

```bash
npm run test
```

This verifies that the server correctly filters specification URLs based on the requested version. The server supports multiple versions including `draft`, `2024-11-05`, and `2025-03-26`, with `2025-03-26` being the default if no version is specified.

## Links

- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/specification/) (supports multiple versions)
