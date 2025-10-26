#!/usr/bin/env node
// List of supported versions
export const SUPPORTED_VERSIONS = ['draft', '2024-11-05', '2025-03-26', '2025-06-18'];

// Default version to use when no specific version is requested
// Can be overridden with DEFAULT_SPEC_VERSION environment variable
const DEFAULT_VERSION = '2025-06-18';
export const VERSION = (() => {
  const envVersion = process.env.DEFAULT_SPEC_VERSION;
  if (envVersion && !SUPPORTED_VERSIONS.includes(envVersion)) {
    console.error(`ERROR: Unsupported version '${envVersion}' specified in DEFAULT_SPEC_VERSION environment variable. Supported versions are: ${SUPPORTED_VERSIONS.join(', ')}. Falling back to default version: ${DEFAULT_VERSION}`);
  }
  return envVersion && SUPPORTED_VERSIONS.includes(envVersion) 
    ? envVersion 
    : DEFAULT_VERSION;
})();

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ServerCapabilities,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  CompleteRequestSchema,
  McpError,
  ErrorCode
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
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

// Suggested topics
const TOPIC_COMPLETIONS = ['tools', 'prompts', 'resources', 'roots', 'sampling', 'transports', 'authorization', 'why not just use http?', 'security best practices', 'cancellation', 'progress reporting', 'server utilities', 'client utilities', 'elicitation'];
// Include all prompt names here
const EXPLAIN_PROMPT = 'explain';
const EVALUATE_SERVER_PROMPT = 'evaluate_server_compliance';

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

// Tool input schemas
const GetResourceSchema = z.object({
  uri: z.string().describe("URI of the resource to fetch (e.g., 'https://modelcontextprotocol.io/specification/2025-06-18/index.md')"),
});

const GetSpecificationResourceSchema = z.object({
  version: z.enum(['draft', '2024-11-05', '2025-03-26', '2025-06-18']).describe("MCP specification version to fetch"),
  section: z.enum(['complete', 'architecture', 'basic', 'utilities', 'server', 'client', 'schema']).optional().describe("Specific section to fetch (defaults to 'complete' which includes all sections)"),
});

const ListAvailableResourcesSchema = z.object({});

const serverCapabilities: ServerCapabilities = {
  prompts: {},
  resources: {},
  tools: {},
  completions: {},
  resourceTemplates: {}
};

const server = new Server(
  { name: 'mcp-advisor', version: '0.5.1' },
  { capabilities: serverCapabilities,
    instructions: `Workflow: 1) Use 'explain' prompt for understanding MCP concepts before implementation, 2) Use 'evaluate_server_compliance' prompt to validate existing server code against specification requirements. Always clarify expected spec version and provide the version parameter when working with specific spec releases. Resource templates support version-specific access - use {version} parameter for precise specification targeting. Performance: Content is cached for 1 hour; initial requests may take 5-10 seconds for complete specification fetching. Limitations: Requires network access to modelcontextprotocol.io; falls back to expired cache on network failures. Supported versions: ${SUPPORTED_VERSIONS.join(', ')} (default: ${VERSION}).`
  }
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
      },
      {
        name: 'version',
        description: `Which MCP specification version to use. Supported versions: ${SUPPORTED_VERSIONS.join(', ')}. If not specified, the default version will be used.`,
        required: false
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
      },
      {
        name: 'version',
        description: `Which MCP specification version to use. Supported versions: ${SUPPORTED_VERSIONS.join(', ')}. If not specified, the default version will be used.`,
        required: false
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
  
  // Extract version from request arguments if provided, otherwise use default
  let promptVersion = VERSION;
  if (request.params.arguments?.version) {
    const requestedVersion = request.params.arguments.version;
    if (!SUPPORTED_VERSIONS.includes(requestedVersion)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unsupported version: '${requestedVersion}'. Supported versions are: ${SUPPORTED_VERSIONS.join(', ')}`
      );
    }
    promptVersion = requestedVersion;
  }

  // Draft version notice text
  const draftNotice = promptVersion === 'draft' ? 
    "Note that the `draft` version you have selected represents the most up-to-date working version that is still evolving and subject to changes. The `draft` version is where active development happens and would contain the most current thinking and proposals before they're finalized into a dated release.\n\n" : 
    "";

  if (promptName === EVALUATE_SERVER_PROMPT) {
    const path = request.params.arguments?.path;
    if (!path) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Path argument is required'
      );
    }
    
    // Get resource info from template
    const specResource = getResourceFromTemplate("MCP Specification by Version", promptVersion);
    const completeDoc = await getCombinedCompleteResourceDoc(promptVersion);
    
    return {
      description: 'Model Context Protocol (MCP) specification compliance evaluation for server repository',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `${draftNotice}Please evaluate the MCP server implementation at path: ${path} for compliance with the full specification provided below.  Pay special attention to the MUST statements in the spec and non-optional features before moving on to SHOULD statements and/or optional enhancements.`
          }
        },
        {
          role: 'user',
          content: {
            type: 'resource',
            resource: {
              uri: specResource.uri,
              mimeType: specResource.mimeType,
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
    
    // Get resource info from template
    const specResource = getResourceFromTemplate("MCP Specification by Version", promptVersion);
    const completeDoc = await getCombinedCompleteResourceDoc(promptVersion);
    
    return {
      description: 'Comprehensive explanation of Model Context Protocol (MCP) topic with full documentation',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `${draftNotice}Please explain ${topic} as it relates to the Model Context Protocol. Include detailed information and examples where possible. You MUST always cite your references when you explain topics or answer questions based on the documentation provided below, and you MUST render a clickable link to the source when applicable.  You MAY ask the user to provide additional references to documentation or resources if you do not already have access to them.`
          }
        },
        {
          role: 'user',
          content: {
            type: 'resource',
            resource: {
              uri: specResource.uri,
              mimeType: specResource.mimeType,
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
  
  if (ref.type === "ref/prompt" && argument?.name === "topic") {
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
  else if ((ref.type === "ref/resource" || ref.type === "ref/prompt") && argument?.name === "version") {
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

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'getResource',
        description: 'Fetch a specific MCP documentation resource by its URI. Use this to retrieve any available resource such as specification sections, tutorials, SDK docs, etc.',
        inputSchema: zodToJsonSchema(GetResourceSchema)
      },
      {
        name: 'getSpecificationResource',
        description: 'Fetch MCP specification documentation for a specific version and optional section. This is a convenient way to get specification content without knowing the exact URI.',
        inputSchema: zodToJsonSchema(GetSpecificationResourceSchema)
      },
      {
        name: 'listAvailableResources',
        description: 'List all available MCP documentation resources with their URIs, names, and descriptions. Use this to discover what resources are available.',
        inputSchema: zodToJsonSchema(ListAvailableResourcesSchema)
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'getResource') {
    const validatedArgs = GetResourceSchema.parse(args);
    const { uri } = validatedArgs;

    // Find the matching resource
    const matchingResource = resources.find(r => r.uri === uri);

    if (!matchingResource) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unknown resource URI: ${uri}. Use listAvailableResources tool to see available resources.`
      );
    }

    try {
      const resourceContent = await fetchResourceContentByUri(uri);

      // Return the resource content as resource references
      return {
        content: resourceContent.map((resource: any) => ({
          type: 'resource' as const,
          resource: resource
        }))
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to fetch resource: ${errorMessage}`
      );
    }
  }

  if (name === 'getSpecificationResource') {
    const validatedArgs = GetSpecificationResourceSchema.parse(args);
    const { version, section = 'complete' } = validatedArgs;

    // Build the URI based on version and section
    let uri: string;
    if (section === 'schema') {
      uri = `https://modelcontextprotocol.io/specification/${version}/schema.json`;
    } else if (section === 'complete') {
      uri = `https://modelcontextprotocol.io/specification/${version}/index.md`;
    } else if (section === 'utilities') {
      uri = `https://modelcontextprotocol.io/specification/${version}/basic/utilities/index.md`;
    } else {
      uri = `https://modelcontextprotocol.io/specification/${version}/${section}/index.md`;
    }

    try {
      const resourceContent = await fetchResourceContentByUri(uri);

      // Return the resource content as resource references
      return {
        content: resourceContent.map((resource: any) => ({
          type: 'resource' as const,
          resource: resource
        }))
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to fetch specification resource: ${errorMessage}`
      );
    }
  }

  if (name === 'listAvailableResources') {
    ListAvailableResourcesSchema.parse(args);

    // Build a formatted list of all available resources
    const resourceList = resources.map(resource => {
      return `**${resource.name}**\n` +
             `URI: ${resource.uri}\n` +
             `Type: ${resource.mimeType}\n` +
             `Description: ${resource.description}`;
    }).join('\n\n---\n\n');

    return {
      content: [
        {
          type: 'text' as const,
          text: `# Available MCP Documentation Resources\n\n` +
                `Total resources: ${resources.length}\n\n` +
                `---\n\n${resourceList}\n\n` +
                `\n## Resource Templates\n\n` +
                `The following resource templates are also available:\n\n` +
                resourceTemplates.map(template =>
                  `**${template.name}**\n` +
                  `URI Template: ${template.uriTemplate}\n` +
                  `Description: ${template.description}`
                ).join('\n\n---\n\n')
        }
      ]
    };
  }

  throw new McpError(
    ErrorCode.MethodNotFound,
    `Unknown tool: ${name}`
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
  },
  
  // New comprehensive coverage resources
  {
    name: 'MCP Community Documentation',
    uri: 'https://modelcontextprotocol.io/community/index.md',
    mimeType: 'text/markdown',
    description: 'Community guidelines including SEP Guidelines, Communication, and Governance'
  },
  {
    name: 'MCP Getting Started Guide',
    uri: 'https://modelcontextprotocol.io/docs/getting-started/index.md',
    mimeType: 'text/markdown',
    description: 'Introduction and getting started with MCP'
  },
  {
    name: 'MCP Learning Resources',
    uri: 'https://modelcontextprotocol.io/docs/learn/index.md',
    mimeType: 'text/markdown',
    description: 'Architecture overview and core concepts'
  },
  {
    name: 'MCP Debugging Tools',
    uri: 'https://modelcontextprotocol.io/legacy/tools/index.md',
    mimeType: 'text/markdown',
    description: 'Debugging tools including the MCP Inspector'
  },
  {
    name: 'MCP Overview',
    uri: 'https://modelcontextprotocol.io/overview/index.md',
    mimeType: 'text/markdown',
    description: 'High-level overview of the Model Context Protocol'
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
    const extractedLinks = text.match(/\(([^)]+)\)/g)?.map(link => link.slice(1, -1)) || [];
    
    // Filter out invalid entries
    const validLinks = extractedLinks.filter(link => {
      // Filter out empty strings and 'MCP' entries
      if (!link || link === 'MCP') {
        return false;
      }
      
      // Check if it looks like a URL
      if (!link.startsWith('http://') && !link.startsWith('https://')) {
        return false;
      }
      
      return true;
    });
    
    Cache.set('llms.txt', validLinks);
    return validLinks;
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

async function getCompleteResourceDoc(baseUri: string, version: string = VERSION): Promise<ContentItem[]> {
  try {
    // Get the schema first for the specified version
    const schema = await getSchemaForVersion(version);
    
    // Get all links and filter for specification URLs matching the specified version
    const allLinks = await fetchLinksList();
    const specLinks = allLinks.filter(url => 
      url.includes(`/specification/${version}/`) && 
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
async function getCombinedCompleteResourceDoc(version: string = VERSION): Promise<string> {
  try {
    // Get all links and filter for specification URLs matching the specified version
    const allLinks = await fetchLinksList();
    const specLinks = allLinks.filter(url => 
      url.includes(`/specification/${version}/`) && 
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
export function extractVersionFromUri(uri: string): string {
  // Default to global version
  let version = VERSION;
  
  // Check for version in URI
  const versionMatch = uri.match(/\/specification\/([^/]+)\//);
  if (versionMatch && versionMatch[1]) {
    // Validate that the version is supported
    if (SUPPORTED_VERSIONS.includes(versionMatch[1])) {
      version = versionMatch[1];
    } else {
      console.error(`ERROR: Unsupported version '${versionMatch[1]}' requested in URI: ${uri}`);
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unsupported version: '${versionMatch[1]}'. Supported versions are: ${SUPPORTED_VERSIONS.join(', ')}`
      );
    }
  }
  
  return version;
}

// Helper function to get a resource from a template with a specific version
function getResourceFromTemplate(templateName: string, version: string): { uri: string, mimeType: string } {
  const template = resourceTemplates.find(t => t.name === templateName);
  if (!template) {
    throw new Error(`Template not found: ${templateName}`);
  }
  
  const uri = template.uriTemplate.replace('{version}', version);
  return { uri, mimeType: template.mimeType };
}

// Helper function to get schema URL for a specific version
function getSchemaUrlForVersion(version: string): string {
  return `https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/heads/main/schema/${version}/schema.json`;
}

// Helper function to fetch resource content by URI
async function fetchResourceContentByUri(uri: string): Promise<ContentItem[]> {
  const version = extractVersionFromUri(uri);

  if (uri.match(/\/specification\/[^/]+\/index\.md$/)) {
    // Complete specification
    return await getCompleteResourceDoc(uri, version);
  }

  if (uri.match(/\/specification\/[^/]+\/schema\.json$/)) {
    // Schema
    const schema = await getSchemaForVersion(version);
    return [{
      uri: uri,
      text: JSON.stringify(schema, null, 2),
      mimeType: 'application/json'
    }];
  }

  // Other resources - fetch and combine
  const links = await fetchLinksList();
  let urls: string[] = [];

  if (uri.match(/\/specification\/[^/]+\/architecture\/index\.md$/)) {
    urls = filterUrlsBySection(links, '/architecture/', version);
  } else if (uri.match(/\/specification\/[^/]+\/basic\/index\.md$/)) {
    urls = filterUrlsBySection(links, '/basic/', version);
  } else if (uri.match(/\/specification\/[^/]+\/basic\/utilities\/index\.md$/)) {
    urls = filterUrlsBySection(links, '/basic/utilities/', version);
  } else if (uri.match(/\/specification\/[^/]+\/server\/index\.md$/)) {
    urls = filterUrlsBySection(links, '/server/', version);
  } else if (uri.match(/\/specification\/[^/]+\/client\/index\.md$/)) {
    urls = filterUrlsBySection(links, '/client/', version);
  } else if (uri === 'https://modelcontextprotocol.io/quickstart/index.md') {
    urls = filterUrlsBySection(links, '/quickstart/');
  } else if (uri === 'https://modelcontextprotocol.io/development/index.md') {
    urls = filterUrlsBySection(links, '/development/');
  } else if (uri === 'https://modelcontextprotocol.io/sdk/index.md') {
    urls = filterUrlsBySection(links, '/sdk/');
  } else if (uri === 'https://modelcontextprotocol.io/tutorials/index.md') {
    urls = filterUrlsBySection(links, '/tutorials/');
  } else if (uri === 'https://modelcontextprotocol.io/docs/index.md') {
    urls = filterUrlsBySection(links, '/docs/');
  } else if (uri === 'https://modelcontextprotocol.io/community/index.md') {
    urls = filterUrlsBySection(links, '/community/');
  } else if (uri === 'https://modelcontextprotocol.io/docs/getting-started/index.md') {
    urls = filterUrlsBySection(links, '/docs/getting-started/');
  } else if (uri === 'https://modelcontextprotocol.io/docs/learn/index.md') {
    urls = filterUrlsBySection(links, '/docs/learn/');
  } else if (uri === 'https://modelcontextprotocol.io/legacy/tools/index.md') {
    urls = filterUrlsBySection(links, '/legacy/tools/');
  } else if (uri === 'https://modelcontextprotocol.io/overview/index.md') {
    urls = filterUrlsBySection(links, '/overview/');
  } else {
    throw new Error(`Unsupported resource URI: ${uri}`);
  }

  const contentPromises = urls.map(url => fetchMarkdownContent(url));
  const contents = await Promise.all(contentPromises);
  const combinedMarkdown = contents.join('\n\n');

  return [{
    uri: uri,
    text: combinedMarkdown,
    mimeType: 'text/markdown'
  }];
}

// Modified getSchema function to accept a version parameter
export async function getSchemaForVersion(version: string): Promise<any> {
  // Validate that the version is supported
  if (!SUPPORTED_VERSIONS.includes(version)) {
    console.error(`ERROR: Unsupported version '${version}' requested for schema`);
    throw new McpError(
      ErrorCode.InvalidParams,
      `Unsupported version: '${version}'. Supported versions are: ${SUPPORTED_VERSIONS.join(', ')}`
    );
  }
  
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

  try {
    const contentItems = await fetchResourceContentByUri(uri);
    return {
      contents: contentItems
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error fetching resource:', error);
    throw new McpError(
      ErrorCode.InternalError,
      `Could not read resource: ${uri} - ${errorMessage}`
    );
  }
});

// Start the server
startServer().catch(console.error);
