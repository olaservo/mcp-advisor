#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  ServerCapabilities, 
  GetPromptRequestSchema, 
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  McpError,
  ErrorCode
} from '@modelcontextprotocol/sdk/types.js';
// Generic caching mechanism
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class Cache {
  private static cache: Map<string, CacheEntry<any>> = new Map();
  private static TTL = 3600000; // 1 hour in milliseconds

  static get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && (Date.now() - entry.timestamp) < this.TTL) {
      return entry.data;
    }
    return null;
  }

  static set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  static getExpired<T>(key: string): T | null {
    const entry = this.cache.get(key);
    return entry ? entry.data : null;
  }
}

const SCHEMA_URL = 'https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/heads/main/schema/2025-03-26/schema.json';

async function getSchema(): Promise<any> {
  const cached = Cache.get<any>(SCHEMA_URL);
  if (cached) {
    return cached;
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(SCHEMA_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const schema = await response.json();
    Cache.set(SCHEMA_URL, schema);
    return schema;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to fetch schema:', errorMessage);
    
    // If we have a cached version, return it even if expired
    const expired = Cache.getExpired<any>(SCHEMA_URL);
    if (expired) {
      console.error('Using expired cache as fallback');
      return expired;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to fetch schema: ${errorMessage}`
    );
  }
}

const serverCapabilities: ServerCapabilities = {
  prompts: {},
  resources: {}
};

const server = new Server(
  { name: 'mcp-advisor', version: '0.0.6' },
  { capabilities: serverCapabilities }
);

const prompts = [
  {
    name: 'mcp-spec-latest',
    description: 'Provides the complete Model Context Protocol JSON schema specification (2025-03-26) for reference'
  }
];

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: prompts
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const promptName = request.params.name;

  if (promptName !== 'mcp-spec-latest') {
    throw new McpError(
      ErrorCode.MethodNotFound,
      `Unknown prompt: ${promptName}`
    );
  }
  
  const schema = await getSchema();
  
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

server.onerror = (error) => {
  console.error('[MCP Error]', error);
};

async function startServer() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Spec Server started');
  } catch (error) {
    console.error('Failed to start server:', error);
  }
}

process.on('SIGINT', () => {
  process.exit(0);
});

const resources = [
  {
    name: 'MCP Specification - Architecture',
    uri: 'https://github.com/modelcontextprotocol/specification/basic/architecture',
    mimeType: 'text/markdown',
    description: 'Overview of the Model Context Protocol architecture.'
  },
  {
    name: 'MCP Specification - Base Protocol',
    uri: 'https://github.com/modelcontextprotocol/specification/basic',
    mimeType: 'text/markdown',
    description: 'Base protocol details for the Model Context Protocol.'
  },
  {
    name: 'MCP Specification - Utilities',
    uri: 'https://github.com/modelcontextprotocol/specification/utilities',
    mimeType: 'text/markdown',
    description: 'Utility features including Ping, Cancellation, and Progress Reporting from the Model Context Protocol specification.'
  },
  {
    name: 'MCP Specification - Server Features',
    uri: 'https://github.com/modelcontextprotocol/specification/server',
    mimeType: 'text/markdown',
    description: 'Server features including Prompts, Resources, Tools, and Server Utilities from the Model Context Protocol specification.'
  },
  {
    name: 'MCP Specification - Client Features',
    uri: 'https://github.com/modelcontextprotocol/specification/client',
    mimeType: 'text/markdown',
    description: 'Client features including Roots and Sampling from the Model Context Protocol specification.'
  }
];

// List of URLs to combine for Base Protocol
const baseProtocolUrls = [
  'https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/tags/2025-03-26/docs/specification/2025-03-26/basic/_index.md',
  'https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/tags/2025-03-26/docs/specification/2025-03-26/basic/transports.md',
  'https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/tags/2025-03-26/docs/specification/2025-03-26/basic/authorization.md',
  'https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/tags/2025-03-26/docs/specification/2025-03-26/basic/lifecycle.md'
];

// List of URLs to combine for Utilities
const utilitiesUrls = [
  'https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/tags/2025-03-26/docs/specification/2025-03-26/basic/utilities/_index.md',
  'https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/tags/2025-03-26/docs/specification/2025-03-26/basic/utilities/ping.md',
  'https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/tags/2025-03-26/docs/specification/2025-03-26/basic/utilities/cancellation.md',
  'https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/tags/2025-03-26/docs/specification/2025-03-26/basic/utilities/progress.md'
];

// List of URLs to combine for Server Features
const serverFeaturesUrls = [
  'https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/tags/2025-03-26/docs/specification/2025-03-26/server/_index.md',
  'https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/tags/2025-03-26/docs/specification/2025-03-26/server/prompts.md',
  'https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/tags/2025-03-26/docs/specification/2025-03-26/server/resources.md',
  'https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/tags/2025-03-26/docs/specification/2025-03-26/server/tools.md',
  'https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/tags/2025-03-26/docs/specification/2025-03-26/server/utilities/completion.md',
  'https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/tags/2025-03-26/docs/specification/2025-03-26/server/utilities/logging.md',
  'https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/tags/2025-03-26/docs/specification/2025-03-26/server/utilities/pagination.md'
];

// List of URLs to combine for Client Features
const clientFeaturesUrls = [
  'https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/tags/2025-03-26/docs/specification/2025-03-26/client/_index.md',
  'https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/tags/2025-03-26/docs/specification/2025-03-26/client/roots.md',
  'https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/tags/2025-03-26/docs/specification/2025-03-26/client/sampling.md'
];

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: resources
  };
});

// Helper function to fetch Markdown content from a URL
async function fetchMarkdownContent(url: string): Promise<string> {
  const cached = Cache.get<string>(url);
  if (cached) {
    return cached;
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    let markdown = await response.text();
    
    // Process front matter if it exists
    if (markdown.startsWith('---')) {
      const secondDash = markdown.indexOf('---', 3);
      if (secondDash !== -1) {
        // Remove the front matter
        markdown = markdown.substring(secondDash + 3).trim();
      }
    }
    
    // Add source URL as reference
    markdown = markdown + '\n\n---\n*Source: ' + url + '*\n';
    
    Cache.set(url, markdown);
    return markdown;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error fetching content from ${url}:`, error);
    
    // For markdown content, we don't use expired cache on error
    // Instead return an error message that can be displayed
    return `**Error:** Failed to load content from ${url}: ${errorMessage}`;
  }
}

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  
  // Determine which resource is being requested and select the appropriate URLs
  let urls: string[] = [];
  let resourceTitle = '';
  const mimeType = 'text/markdown';
  
  if (uri === 'https://github.com/modelcontextprotocol/specification/basic/architecture') {
    // For architecture, we just have a single file
    urls = ['https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/tags/2025-03-26/docs/specification/2025-03-26/architecture/_index.md'];
    resourceTitle = 'MCP Specification - Architecture';
  } else if (uri === 'https://github.com/modelcontextprotocol/specification/basic') {
    urls = baseProtocolUrls;
    resourceTitle = 'MCP Specification - Base Protocol (Combined Documentation)';
  } else if (uri === 'https://github.com/modelcontextprotocol/specification/utilities') {
    urls = utilitiesUrls;
    resourceTitle = 'MCP Specification - Utilities (Combined Documentation)';
  } else if (uri === 'https://github.com/modelcontextprotocol/specification/server') {
    urls = serverFeaturesUrls;
    resourceTitle = 'MCP Specification - Server Features (Combined Documentation)';
  } else if (uri === 'https://github.com/modelcontextprotocol/specification/client') {
    urls = clientFeaturesUrls;
    resourceTitle = 'MCP Specification - Client Features (Combined Documentation)';
  } else {
    throw new McpError(
      ErrorCode.MethodNotFound,
      `Unknown resource: ${uri}`
    );
  }
  
  // We found a supported resource, now fetch and combine the content
  try {
    // Initialize an empty string for the combined markdown
    let combinedMarkdown = '';
    
    // Fetch content from all URLs and combine them
    const contentPromises = urls.map(async (url, index) => {
      const content = await fetchMarkdownContent(url);
      
      // For all pages except the first one, we want to add a section divider
      if (index > 0) {
        const fileName = url.split('/').pop() || '';
        const sectionName = fileName.replace('.md', '').replace('_index', 'Overview');
        return `\n\n## ${sectionName}\n\n${content}`;
      }
      return content;
    });
    
    // Wait for all content to be fetched
    const contents = await Promise.all(contentPromises);
    
    // Combine all markdown content
    const contentWithSections = contents.join('\n\n');
    combinedMarkdown += contentWithSections;
    
    // Return the combined content
    return {
      contents: [
        {
          uri: uri,
          text: combinedMarkdown,
          mimeType: mimeType
        }
      ]
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error combining specifications:', error);
    throw new McpError(
      ErrorCode.InternalError,
      `Could not read resource: ${uri} - ${errorMessage}`
    );
  }
});

// Start the server
startServer().catch(console.error);
