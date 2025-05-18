#!/usr/bin/env node
// Default version to use when no specific version is requested
export const VERSION = '2025-03-26';

// List of supported versions
export const SUPPORTED_VERSIONS = ['draft', '2024-11-05', '2025-03-26'];

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  ServerCapabilities, 
  GetPromptRequestSchema, 
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
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

const SCHEMA_URL = `https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/heads/main/schema/${VERSION}/schema.json`;

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

// Define resource templates with version parameter
const resourceTemplates = [
  {
    name: "MCP Specification by Version",
    uriTemplate: "https://modelcontextprotocol.io/specification/{version}/index.md",
    description: "Access the MCP specification for any supported version",
    mimeType: "text/markdown"
  },
  {
    name: "MCP Specification Schema by Version",
    uriTemplate: "https://modelcontextprotocol.io/specification/{version}/schema.json",
    description: "Access the MCP specification JSON schema for any supported version",
    mimeType: "application/json"
  },
  {
    name: "MCP Specification Architecture by Version",
    uriTemplate: "https://modelcontextprotocol.io/specification/{version}/architecture/index.md",
    description: "Access the MCP architecture specification for any supported version",
    mimeType: "text/markdown"
  },
  {
    name: "MCP Specification Base Protocol by Version",
    uriTemplate: "https://modelcontextprotocol.io/specification/{version}/basic/index.md",
    description: "Access the MCP base protocol specification for any supported version",
    mimeType: "text/markdown"
  },
  {
    name: "MCP Specification Utilities by Version",
    uriTemplate: "https://modelcontextprotocol.io/specification/{version}/basic/utilities/index.md",
    description: "Access the MCP utilities specification for any supported version",
    mimeType: "text/markdown"
  },
  {
    name: "MCP Specification Server Features by Version",
    uriTemplate: "https://modelcontextprotocol.io/specification/{version}/server/index.md",
    description: "Access the MCP server features specification for any supported version",
    mimeType: "text/markdown"
  },
  {
    name: "MCP Specification Client Features by Version",
    uriTemplate: "https://modelcontextprotocol.io/specification/{version}/client/index.md",
    description: "Access the MCP client features specification for any supported version",
    mimeType: "text/markdown"
  }
];

const serverCapabilities: ServerCapabilities = {
  prompts: {},
  resources: {},
  completions: {},
  resourceTemplates: {} // Add resource templates capability
};

const server = new Server(
  { name: 'mcp-advisor', version: '0.1.0' },
  { capabilities: serverCapabilities }
);

const prompts = [
  {
    name: EXPLAIN_PROMPT,
    description: 'Comprehensive explanation of Model Context Protocol (MCP) topics with full documentation context',
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
    description: 'Evaluates Model Context Protocol (MCP) specification compliance for a given server repository',
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
    
    const completeSpecResource = resources.find(r => r.uri === `https://modelcontextprotocol.io/specification/${VERSION}/index.md`);
    const completeDoc = await getCombinedCompleteResourceDoc();
    return {
      description: 'Model Context Protocol (MCP) specification compliance evaluation for server repository',
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
    
    const completeSpecResource = resources.find(r => r.uri === `https://modelcontextprotocol.io/specification/${VERSION}/index.md`);
    const completeDoc = await getCombinedCompleteResourceDoc();
    return {
      description: 'Comprehensive explanation of Model Context Protocol (MCP) topic with full documentation',
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

// Add handler for listing resource templates
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  return {
    resourceTemplates: resourceTemplates
  };
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
  else if (ref.type === "ref/resource" && argument?.name === "version") {
    // Filter versions that start with the input value if provided
    const values = argument?.value 
      ? SUPPORTED_VERSIONS.filter(v => v.startsWith(argument.value))
      : SUPPORTED_VERSIONS;
    
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
    `Unknown reference type or argument in completion request`
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
    uri: `https://modelcontextprotocol.io/specification/${VERSION}/index.md`,
    mimeType: 'text/markdown',
    description: 'The complete Model Context Protocol specification including schema, architecture, base protocol, utilities, server features, and client features'
  },
  {
    name: 'MCP Specification JSON Schema',
    uri: `https://modelcontextprotocol.io/specification/${VERSION}/schema.json`,
    mimeType: 'application/json',
    description: `The complete Model Context Protocol JSON schema specification (${VERSION})`
  },
  {
    name: 'MCP Specification - Architecture',
    uri: `https://modelcontextprotocol.io/specification/${VERSION}/architecture/index.md`,
    mimeType: 'text/markdown',
    description: 'Overview of the Model Context Protocol architecture.'
  },
  {
    name: 'MCP Specification - Base Protocol',
    uri: `https://modelcontextprotocol.io/specification/${VERSION}/basic/index.md`,
    mimeType: 'text/markdown',
    description: 'Base protocol details for the Model Context Protocol.'
  },
  {
    name: 'MCP Specification - Utilities',
    uri: `https://modelcontextprotocol.io/specification/${VERSION}/basic/utilities/index.md`,
    mimeType: 'text/markdown',
    description: 'Utility features including Ping, Cancellation, and Progress Reporting from the Model Context Protocol specification.'
  },
  {
    name: 'MCP Specification - Server Features',
    uri: `https://modelcontextprotocol.io/specification/${VERSION}/server/index.md`,
    mimeType: 'text/markdown',
    description: 'Server features including Prompts, Resources, Tools, and Server Utilities from the Model Context Protocol specification.'
  },
  {
    name: 'MCP Specification - Client Features',
    uri: `https://modelcontextprotocol.io/specification/${VERSION}/client/index.md`,
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

// Helper function to filter URLs by section and version
export function filterUrlsBySection(links: string[], section: string, version: string = VERSION): string[] {
  // Skip empty links and "MCP" entries, and filter to match specified version only
  const validLinks = links.filter(url => 
    url && 
    url !== 'MCP' && 
    (url.includes(`/${version}/`) || !url.match(/\/20\d{2}-\d{2}-\d{2}\/|\/draft\//))
  );

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

// Define a type for content items
interface ContentItem {
  uri: string;
  text: string;
  mimeType: string;
}

async function getCompleteResourceDoc(baseUri: string): Promise<ContentItem[]> {
  try {
    // Get the schema first
    const schema = await getSchema();
    
    // Get all links and filter for specification URLs matching our version
    const allLinks = await fetchLinksList();
    const specLinks = allLinks.filter(url => 
      url.includes(`/specification/${VERSION}/`) && 
      !url.includes('schema.json')  // Exclude schema.json as we handle it separately
    );
    
    // Create array to hold multiple contents
    const contents: ContentItem[] = [];
    
    // Add the schema as the first content
    contents.push({
      uri: `${baseUri}#schema`,
      text: JSON.stringify(schema, null, 2),
      mimeType: 'application/json'
    });
    
    // Define the order of sections
    const sections = [
      'architecture',
      'basic',
      'basic/utilities',
      'client',
      'server',
      'server/utilities'
    ];
    
    // Fetch and combine content for each section
    for (const section of sections) {
      const sectionLinks = filterUrlsBySection(specLinks, `/${section}/`);
      
      // Skip empty sections
      if (sectionLinks.length === 0) continue;
      
      // Fetch content from all URLs in this section
      const contentPromises = sectionLinks.map(url => fetchMarkdownContent(url));
      const sectionContents = await Promise.all(contentPromises);
      
      // Add section content
      const sectionTitle = section.split('/').pop() || section;
      let sectionDoc = `# ${sectionTitle.charAt(0).toUpperCase() + sectionTitle.slice(1)}\n\n`;
      sectionDoc += sectionContents.join('\n\n');
      
      // Add as a separate content item
      contents.push({
        uri: `${baseUri}#${section}`,
        text: sectionDoc,
        mimeType: 'text/markdown'
      });
    }
    
    return contents;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new McpError(
      ErrorCode.InternalError,
      `Could not generate complete specification: ${errorMessage}`
    );
  }
}

// Helper function to combine all content items into a single document
// This is used for backward compatibility with the prompts
async function getCombinedCompleteResourceDoc(): Promise<string> {
  try {
    // Get all links and filter for specification URLs matching our version
    const allLinks = await fetchLinksList();
    const specLinks = allLinks.filter(url => 
      url.includes(`/specification/${VERSION}/`) && 
      !url.includes('schema.json')  // Exclude schema.json as we handle it separately
    );
    
    // Build the complete document
    let completeDoc = '# Model Context Protocol Documentation\n\n';
    
    // Define the order of sections
    const sections = [
      'architecture',
      'basic',
      'basic/utilities',
      'client',
      'server',
      'server/utilities'
    ];
    
    // Fetch and combine content for each section
    for (const section of sections) {
      const sectionLinks = filterUrlsBySection(specLinks, `/${section}/`);
      
      // Skip empty sections
      if (sectionLinks.length === 0) continue;
      
      // Fetch content from all URLs in this section
      const contentPromises = sectionLinks.map(url => fetchMarkdownContent(url));
      const contents = await Promise.all(contentPromises);
      
      // Add section content
      const sectionTitle = section.split('/').pop() || section;
      completeDoc += `\n\n## ${sectionTitle.charAt(0).toUpperCase() + sectionTitle.slice(1)}\n\n`;
      completeDoc += contents.join('\n\n');
    }
    
    return completeDoc;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new McpError(
      ErrorCode.InternalError,
      `Could not generate complete specification: ${errorMessage}`
    );
  }
}

// Helper function to extract version from URI
function extractVersionFromUri(uri: string): string {
  // Default to global version
  let version = VERSION;
  
  // Check for version in URI
  const versionMatch = uri.match(/\/specification\/([^/]+)\//);
  if (versionMatch && versionMatch[1]) {
    // Validate that the version is supported
    if (SUPPORTED_VERSIONS.includes(versionMatch[1])) {
      version = versionMatch[1];
    } else {
      console.error(`Unsupported version requested: ${versionMatch[1]}, using default: ${VERSION}`);
    }
  }
  
  return version;
}

// Helper function to get schema URL for a specific version
function getSchemaUrlForVersion(version: string): string {
  return `https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/heads/main/schema/${version}/schema.json`;
}

// Modified getSchema function to accept a version parameter
async function getSchemaForVersion(version: string): Promise<any> {
  const schemaUrl = getSchemaUrlForVersion(version);
  const cached = Cache.get<any>(schemaUrl);
  if (cached) {
    return cached;
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(schemaUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const schema = await response.json();
    Cache.set(schemaUrl, schema);
    return schema;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to fetch schema for version ${version}:`, errorMessage);
    
    // If we have a cached version, return it even if expired
    const expired = Cache.getExpired<any>(schemaUrl);
    if (expired) {
      console.error('Using expired cache as fallback');
      return expired;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to fetch schema for version ${version}: ${errorMessage}`
    );
  }
}

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  
  // Extract version from URI
  const version = extractVersionFromUri(uri);
  
  // Determine which resource is being requested and select the appropriate URLs
  let urls: string[] = [];
  let resourceTitle = '';
  const mimeType = 'text/markdown';
  
  if (uri.match(/\/specification\/[^/]+\/architecture\/index\.md$/)) {
    // Get all architecture-related links
    const links = await fetchLinksList();
    urls = filterUrlsBySection(links, '/architecture/', version);
    resourceTitle = 'MCP Specification - Architecture';
  } else if (uri.match(/\/specification\/[^/]+\/basic\/index\.md$/)) {
    const links = await fetchLinksList();
    urls = filterUrlsBySection(links, '/basic/', version);
    resourceTitle = 'MCP Specification - Base Protocol';
  } else if (uri.match(/\/specification\/[^/]+\/basic\/utilities\/index\.md$/)) {
    const links = await fetchLinksList();
    urls = filterUrlsBySection(links, '/basic/utilities/', version);
    resourceTitle = 'MCP Specification - Utilities';
  } else if (uri.match(/\/specification\/[^/]+\/server\/index\.md$/)) {
    const links = await fetchLinksList();
    urls = filterUrlsBySection(links, '/server/', version);
    resourceTitle = 'MCP Specification - Server Features';
  } else if (uri.match(/\/specification\/[^/]+\/client\/index\.md$/)) {
    const links = await fetchLinksList();
    urls = filterUrlsBySection(links, '/client/', version);
    resourceTitle = 'MCP Specification - Client Features';
  } else if (uri.match(/\/specification\/[^/]+\/index\.md$/)) {
    // Return the complete specification using multiple contents pattern
    try {
      const contentItems = await getCompleteResourceDoc(uri);
      return {
        contents: contentItems
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
  } else if (uri.match(/\/specification\/[^/]+\/schema\.json$/)) {
    // Return the schema as JSON
    try {
      const schema = await getSchemaForVersion(version);
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
