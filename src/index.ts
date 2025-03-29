#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  ServerCapabilities, 
  GetPromptRequestSchema, 
  ListPromptsRequestSchema,
  McpError,
  ErrorCode
} from '@modelcontextprotocol/sdk/types.js';
import schema from './schema/schema.json' with { type: 'json' };

// Define server capabilities - only need prompts for this server
const serverCapabilities: ServerCapabilities = {
  prompts: {}
};

// Create server instance
const server = new Server(
  { name: 'mcp-spec-server', version: '0.0.4' },
  { capabilities: serverCapabilities }
);

// Define the one prompt we offer
const prompts = [
  {
    name: 'mcp-spec-latest',
    description: 'Provides the complete Model Context Protocol JSON schema specification (2025-03-26) for reference'
  }
];

// Set up prompts request handlers
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: prompts
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const promptName = request.params.name;
  
  // We only have one prompt, so verify it's the one being requested
  if (promptName !== 'mcp-spec-latest') {
    throw new McpError(
      ErrorCode.MethodNotFound,
      `Unknown prompt: ${promptName}`
    );
  }
  
  // Return the schema JSON as the prompt content
  return {
    description: 'Provides the complete Model Context Protocol JSON schema specification (2025-03-26) for reference',
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: JSON.stringify(schema)
        }
      }
    ]
  };
});

// Error handler
server.onerror = (error) => {
  console.error('[MCP Error]', error);
};

// Start the server with a stdio transport
async function startServer() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Spec Server started');
  } catch (error) {
    console.error('Failed to start server:', error);
  }
}

// Handle process signals for clean shutdown
process.on('SIGINT', () => {
  process.exit(0);
});

// Start the server
startServer().catch(console.error);
