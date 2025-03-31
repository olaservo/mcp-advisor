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
  { name: 'mcp-advisor', version: '0.0.7' },
  { capabilities: serverCapabilities }
);

const prompts = [
  {
    name: 'explain',
    description: 'Comprehensive explanation of MCP topics with full documentation context',
    arguments: [
      {
        name: 'topic',
        description: 'Which MCP topic would you like explained in detail?',
        required: true
      }
    ]
  }
];

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: prompts
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const promptName = request.params.name;

  if (promptName === 'explain') {
    const topic = request.params.arguments?.topic;
    if (!topic) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Topic argument is required'
      );
    }
    
    const completeSpecResource = resources.find(r => r.uri === 'https://github.com/modelcontextprotocol/specification/complete');
    const completeDoc = await getCompleteResourceDoc();
    return {
      description: 'Comprehensive explanation of MCP topic with full documentation',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please explain ${topic} as it relates to the Model Context Protocol. Include detailed information and examples where possible. You MUST always cite your references when you explain topics or answer questions based on the documentation provided below.  You MAY ask the user to provide additional references to documentation or resources if you do not already have access to them.`
          }
        },
        {
          role: 'user',
          content: {
            type: 'resource',
            resource: {
              uri:completeSpecResource?.uri,
              mimeType:completeSpecResource?.mimeType,
              text: completeDoc
            }
          }
        }
      ]
    };
  }

  throw new McpError(
    ErrorCode.MethodNotFound,
    `Unknown prompt: ${promptName}`
  );
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
    name: 'MCP Complete Specification',
    uri: 'https://github.com/modelcontextprotocol/specification/complete',
    mimeType: 'text/markdown',
    description: 'The complete Model Context Protocol specification including schema, architecture, base protocol, utilities, server features, and client features'
  },
  {
    name: 'MCP Schema Specification',
    uri: 'https://github.com/modelcontextprotocol/specification/schema',
    mimeType: 'application/json',
    description: 'The complete Model Context Protocol JSON schema specification (2025-03-26)'
  },
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

// Helper function to transform raw GitHub URLs to regular GitHub URLs
function transformGitHubUrl(url: string): string {
  if (url.startsWith('https://raw.githubusercontent.com/')) {
    const parts = url.replace('https://raw.githubusercontent.com/', '').split('/');
    const org = parts[0];
    const repo = parts[1];
    const tagsIndex = parts.indexOf('tags');
    if (tagsIndex !== -1 && parts.length > tagsIndex + 1) {
      const version = parts[tagsIndex + 1];
      const pathParts = parts.slice(tagsIndex + 2);
      const path = pathParts.join('/');
      return `https://github.com/${org}/${repo}/blob/${version}/${path}`;
    }
  }
  return url;
}

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
    
    // Add source URL as reference with transformed GitHub URL
    const displayUrl = transformGitHubUrl(url);
    markdown = markdown + '\n\n---\n*Source: [' + displayUrl + '](' + displayUrl + ')*\n';
    
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

async function getCompleteResourceDoc() {
  try {
    // Get the schema first
    const schema = await getSchema();
    
    // Fetch all markdown content
    const architectureContent = await fetchMarkdownContent('https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/tags/2025-03-26/docs/specification/2025-03-26/architecture/_index.md');
    
    // Fetch and combine all section content
    const baseProtocolContent = await Promise.all(baseProtocolUrls.map(fetchMarkdownContent));
    const utilitiesContent = await Promise.all(utilitiesUrls.map(fetchMarkdownContent));
    const serverFeaturesContent = await Promise.all(serverFeaturesUrls.map(fetchMarkdownContent));
    const clientFeaturesContent = await Promise.all(clientFeaturesUrls.map(fetchMarkdownContent));
    
    // Build the complete document
    let completeDoc = '# Model Context Protocol Complete Specification\n\n';
    
    // Add schema section
    completeDoc += '## JSON Schema\n\n```json\n' + JSON.stringify(schema, null, 2) + '\n```\n\n';
    
    // Add architecture section
    completeDoc += '## Architecture\n\n' + architectureContent + '\n\n';
    
    // Add base protocol section
    completeDoc += '## Base Protocol\n\n' + baseProtocolContent.join('\n\n') + '\n\n';
    
    // Add utilities section
    completeDoc += '## Utilities\n\n' + utilitiesContent.join('\n\n') + '\n\n';
    
    // Add server features section
    completeDoc += '## Server Features\n\n' + serverFeaturesContent.join('\n\n') + '\n\n';
    
    // Add client features section
    completeDoc += '## Client Features\n\n' + clientFeaturesContent.join('\n\n');
    
    return completeDoc;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new McpError(
      ErrorCode.InternalError,
      `Could not generate complete specification: ${errorMessage}`
    );
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
  } else if (uri === 'https://github.com/modelcontextprotocol/specification/complete') {
    // Return the complete specification including schema and all markdown content
    try {
      const completeDoc = await getCompleteResourceDoc();
      return {
        contents: [
          {
            uri: uri,
            text: completeDoc,
            mimeType: 'text/markdown'
          }
        ]
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Could not generate complete specification: ${errorMessage}`
      );
    }
  } else if (uri === 'https://github.com/modelcontextprotocol/specification/schema') {
    // Return the schema as JSON
    try {
      const schema = await getSchema();
      return {
        contents: [
          {
            uri: uri,
            text: JSON.stringify(schema, null, 2),
            mimeType: 'application/json'
          }
        ]
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Could not read schema resource: ${errorMessage}`
      );
    }
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
