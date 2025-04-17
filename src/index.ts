#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  ServerCapabilities, 
  GetPromptRequestSchema, 
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  CompleteRequestSchema,
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

// Suggested topics
const TOPIC_COMPLETIONS = ['tools', 'prompts', 'resources', 'roots', 'sampling', 'transports', 'why not just use http?', 'why does this protocol need to exist?'];
// Include all prompt names here
const EXPLAIN_PROMPT = 'explain';
const EVALUATE_SERVER_PROMPT = 'evaluate_server_compliance';

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
  resources: {},
  completions: {}
};

const server = new Server(
  { name: 'mcp-advisor', version: '0.0.8' },
  { capabilities: serverCapabilities }
);

const prompts = [
  {
    name: EXPLAIN_PROMPT,
    description: 'Comprehensive explanation of MCP topics with full documentation context',
    arguments: [
      {
        name: 'topic',
        description: 'Which MCP topic would you like explained in detail? Feel free to phrase as a question.',
        required: true
      }
    ]
  },
  {
    name: EVALUATE_SERVER_PROMPT,
    description: 'Evaluates MCP specification compliance for a given server repository',
    arguments: [
      {
        name: 'path',
        description: 'Path to the MCP server repository to evaluate.',
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

  if (promptName === EVALUATE_SERVER_PROMPT) {
    const path = request.params.arguments?.path;
    if (!path) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Path argument is required'
      );
    }
    
    const completeSpecResource = resources.find(r => r.uri === 'https://modelcontextprotocol.io/specification/2025-03-26/index.md');
    const completeDoc = await getCompleteResourceDoc();
    return {
      description: 'MCP specification compliance evaluation for server repository',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please evaluate the MCP server implementation at path: ${path} for compliance with the full specification provided below.  Pay special attention to the MUST statements in the spec and non-optional features before moving on to SHOULD statements and/or optional enhancements.`
          }
        },
        {
          role: 'user',
          content: {
            type: 'resource',
            resource: {
              uri: completeSpecResource?.uri,
              mimeType: completeSpecResource?.mimeType,
              text: completeDoc
            }
          }
        }
      ]
    };
  } else if (promptName === EXPLAIN_PROMPT) {
    const topic = request.params.arguments?.topic;
    if (!topic) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Topic argument is required'
      );
    }
    
    const completeSpecResource = resources.find(r => r.uri === 'https://modelcontextprotocol.io/specification/2025-03-26/index.md');
    const completeDoc = await getCompleteResourceDoc();
    return {
      description: 'Comprehensive explanation of MCP topic with full documentation',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please explain ${topic} as it relates to the Model Context Protocol. Include detailed information and examples where possible. You MUST always cite your references when you explain topics or answer questions based on the documentation provided below, and you MUST render a clickable link to the source when applicable.  You MAY ask the user to provide additional references to documentation or resources if you do not already have access to them.`
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

server.setRequestHandler(CompleteRequestSchema, async (request) => {
    const { ref, argument } = request.params;
    if (ref.type === "ref/prompt") {
      // Filter topics that start with the input value if provided
      const values = argument?.value 
        ? TOPIC_COMPLETIONS.filter(topic => topic.toLowerCase().startsWith(argument.value.toLowerCase()))
        : TOPIC_COMPLETIONS;
      return { 
        completion: { 
          values,
          hasMore: false, 
          total: values.length 
        } 
      };
    }
    throw new McpError(
      ErrorCode.InvalidParams,
      `Unknown reference type passed in completion request`
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
  // Specification Resources
  {
    name: 'MCP Complete Specification',
    uri: 'https://modelcontextprotocol.io/specification/2025-03-26/index.md',
    mimeType: 'text/markdown',
    description: 'The complete Model Context Protocol specification including schema, architecture, base protocol, utilities, server features, and client features'
  },
  {
    name: 'MCP Schema Specification',
    uri: 'https://modelcontextprotocol.io/specification/2025-03-26/schema.json',
    mimeType: 'application/json',
    description: 'The complete Model Context Protocol JSON schema specification (2025-03-26)'
  },
  {
    name: 'MCP Specification - Architecture',
    uri: 'https://modelcontextprotocol.io/specification/2025-03-26/architecture/index.md',
    mimeType: 'text/markdown',
    description: 'Overview of the Model Context Protocol architecture.'
  },
  {
    name: 'MCP Specification - Base Protocol',
    uri: 'https://modelcontextprotocol.io/specification/2025-03-26/basic/index.md',
    mimeType: 'text/markdown',
    description: 'Base protocol details for the Model Context Protocol.'
  },
  {
    name: 'MCP Specification - Utilities',
    uri: 'https://modelcontextprotocol.io/specification/2025-03-26/basic/utilities/index.md',
    mimeType: 'text/markdown',
    description: 'Utility features including Ping, Cancellation, and Progress Reporting from the Model Context Protocol specification.'
  },
  {
    name: 'MCP Specification - Server Features',
    uri: 'https://modelcontextprotocol.io/specification/2025-03-26/server/index.md',
    mimeType: 'text/markdown',
    description: 'Server features including Prompts, Resources, Tools, and Server Utilities from the Model Context Protocol specification.'
  },
  {
    name: 'MCP Specification - Client Features',
    uri: 'https://modelcontextprotocol.io/specification/2025-03-26/client/index.md',
    mimeType: 'text/markdown',
    description: 'Client features including Roots and Sampling from the Model Context Protocol specification.'
  },
  
  // Additional Documentation Resources
  {
    name: 'MCP Getting Started',
    uri: 'https://modelcontextprotocol.io/quickstart/index.md',
    mimeType: 'text/markdown',
    description: 'Getting started guides for client developers, server developers, and users'
  },
  {
    name: 'MCP Development',
    uri: 'https://modelcontextprotocol.io/development/index.md',
    mimeType: 'text/markdown',
    description: 'Development resources including contributing guidelines, roadmap, and updates'
  },
  {
    name: 'MCP SDK Documentation',
    uri: 'https://modelcontextprotocol.io/sdk/index.md',
    mimeType: 'text/markdown',
    description: 'SDK documentation for various programming languages'
  },
  {
    name: 'MCP Tutorials & Examples',
    uri: 'https://modelcontextprotocol.io/tutorials/index.md',
    mimeType: 'text/markdown',
    description: 'Tutorials, examples, and implementation guides'
  },
  {
    name: 'MCP General Documentation',
    uri: 'https://modelcontextprotocol.io/docs/index.md',
    mimeType: 'text/markdown',
    description: 'General documentation including FAQs, introduction, and client list'
  }
];

// Helper function to fetch and parse links from llms.txt
export async function fetchLinksList(): Promise<string[]> {
  const cached = Cache.get<string[]>('llms.txt');
  if (cached) {
    return cached;
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://modelcontextprotocol.io/llms.txt');
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const text = await response.text();
    const links = text.match(/\(([^)]+)\)/g)?.map(link => link.slice(1, -1)) || [];
    Cache.set('llms.txt', links);
    return links;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to fetch links list:', errorMessage);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to fetch links list: ${errorMessage}`
    );
  }
}

// Helper function to fetch complete content from llms-full.txt
async function fetchFullContent(): Promise<string> {
  const cached = Cache.get<string>('llms-full.txt');
  if (cached) {
    return cached;
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://modelcontextprotocol.io/llms-full.txt');
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const content = await response.text();
    Cache.set('llms-full.txt', content);
    return content;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to fetch full content:', errorMessage);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to fetch full content: ${errorMessage}`
    );
  }
}

// Helper function to filter URLs by section
export function filterUrlsBySection(links: string[], section: string): string[] {
  // Skip empty links and "MCP" entries
  const validLinks = links.filter(url => url && url !== 'MCP');

  // Handle regex patterns
  if (section.startsWith('^')) {
    const regex = new RegExp(section);
    return validLinks.filter(url => {
      const urlPath = url.split('/').pop() || '';
      return regex.test(urlPath);
    });
  }

  // Handle GitHub SDK repositories
  if (section === 'github.com/modelcontextprotocol/') {
    return validLinks.filter(url => url.startsWith('https://github.com/modelcontextprotocol/'));
  }

  // Handle top-level documentation files
  if (section === '/docs/') {
    return validLinks.filter(url => {
      const parts = url.split('/');
      return parts.length === 4 && parts[3].endsWith('.md');
    });
  }

  // Default case: match by section path
  return validLinks.filter(url => url.includes(section));
}

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
    markdown = markdown + '\n\n---\n*Source: [' + url + '](' + url + ')*\n';
    
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
    
    // Fetch the complete content from llms-full.txt
    const completeContent = await fetchFullContent();
    
    // Build the complete document
    let completeDoc = '# Model Context Protocol Complete Specification\n\n';
    
    // Add schema section
    completeDoc += '## JSON Schema\n\n```json\n' + JSON.stringify(schema, null, 2) + '\n```\n\n';
    
    // Add the complete content
    completeDoc += completeContent;
    
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
  
  if (uri === 'https://modelcontextprotocol.io/specification/2025-03-26/architecture/index.md') {
    // Get all architecture-related links
    const links = await fetchLinksList();
    urls = filterUrlsBySection(links, '/architecture/');
    resourceTitle = 'MCP Specification - Architecture';
  } else if (uri === 'https://modelcontextprotocol.io/specification/2025-03-26/basic/index.md') {
    const links = await fetchLinksList();
    urls = filterUrlsBySection(links, '/basic/');
    resourceTitle = 'MCP Specification - Base Protocol';
  } else if (uri === 'https://modelcontextprotocol.io/specification/2025-03-26/basic/utilities/index.md') {
    const links = await fetchLinksList();
    urls = filterUrlsBySection(links, '/basic/utilities/');
    resourceTitle = 'MCP Specification - Utilities';
  } else if (uri === 'https://modelcontextprotocol.io/specification/2025-03-26/server/index.md') {
    const links = await fetchLinksList();
    urls = filterUrlsBySection(links, '/server/');
    resourceTitle = 'MCP Specification - Server Features';
  } else if (uri === 'https://modelcontextprotocol.io/specification/2025-03-26/client/index.md') {
    const links = await fetchLinksList();
    urls = filterUrlsBySection(links, '/client/');
    resourceTitle = 'MCP Specification - Client Features';
  } else if (uri === 'https://modelcontextprotocol.io/specification/2025-03-26/index.md') {
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
  } else if (uri === 'https://modelcontextprotocol.io/quickstart/index.md') {
    const links = await fetchLinksList();
    urls = filterUrlsBySection(links, '/quickstart/');
    resourceTitle = 'MCP Getting Started';
  } else if (uri === 'https://modelcontextprotocol.io/development/index.md') {
    const links = await fetchLinksList();
    urls = filterUrlsBySection(links, '/development/');
    resourceTitle = 'MCP Development';
  } else if (uri === 'https://modelcontextprotocol.io/sdk/index.md') {
    const links = await fetchLinksList();
    urls = filterUrlsBySection(links, '/sdk/');
    resourceTitle = 'MCP SDK Documentation';
  } else if (uri === 'https://modelcontextprotocol.io/tutorials/index.md') {
    const links = await fetchLinksList();
    urls = filterUrlsBySection(links, '/tutorials/');
    resourceTitle = 'MCP Tutorials & Examples';
  } else if (uri === 'https://modelcontextprotocol.io/docs/index.md') {
    const links = await fetchLinksList();
    urls = filterUrlsBySection(links, '/docs/');
    resourceTitle = 'MCP General Documentation';
  } else if (uri === 'https://modelcontextprotocol.io/specification/2025-03-26/schema.json') {
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
