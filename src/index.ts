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
import schema from './schema/schema.json' with { type: 'json' };

// You may need to install node-fetch if not already installed:
// npm install node-fetch
// Also, we'll need jsdom for parsing HTML:
// npm install jsdom
// For TypeScript support:
// npm install --save-dev @types/jsdom

// Define server capabilities - need prompts and resources for this server
const serverCapabilities: ServerCapabilities = {
  prompts: {},
  resources: {}
};

// Create server instance
const server = new Server(
  { name: 'mcp-advisor', version: '0.0.5' },
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

// Define the resources we offer
const resources = [
  {
    name: 'MCP Specification - Base Protocol',
    uri: 'https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/',
    mimeType: 'text/html',
    description: 'Base protocol details for the Model Context Protocol from the official specification.'
  },
  {
    name: 'MCP Specification - Utilities',
    uri: 'https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/utilities/',
    mimeType: 'text/html',
    description: 'Utility features including ping, cancellation, and progress reporting.'
  },
  {
    name: 'MCP Specification - Server Features',
    uri: 'https://spec.modelcontextprotocol.io/specification/2025-03-26/server/',
    mimeType: 'text/html',
    description: 'Server features including prompts, resources, tools, and server utilities.'
  },
  {
    name: 'MCP Specification - Client Features',
    uri: 'https://spec.modelcontextprotocol.io/specification/2025-03-26/client/',
    mimeType: 'text/html',
    description: 'Client features including roots and sampling.'
  }
];

// List of URLs to combine for Base Protocol
const baseProtocolUrls = [
  'https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/',
  'https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/transports/',
  'https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/authorization/',
  'https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle/'
];

// List of URLs to combine for Utilities
const utilitiesUrls = [
  'https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/utilities/',
  'https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/utilities/ping/',
  'https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/utilities/cancellation/',
  'https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/utilities/progress/'
];

// List of URLs to combine for Server Features
const serverFeaturesUrls = [
  'https://spec.modelcontextprotocol.io/specification/2025-03-26/server/',
  'https://spec.modelcontextprotocol.io/specification/2025-03-26/server/prompts/',
  'https://spec.modelcontextprotocol.io/specification/2025-03-26/server/resources/',
  'https://spec.modelcontextprotocol.io/specification/2025-03-26/server/tools/',
  'https://spec.modelcontextprotocol.io/specification/2025-03-26/server/utilities/completion/',
  'https://spec.modelcontextprotocol.io/specification/2025-03-26/server/utilities/logging/',
  'https://spec.modelcontextprotocol.io/specification/2025-03-26/server/utilities/pagination/'
];

// List of URLs to combine for Client Features
const clientFeaturesUrls = [
  'https://spec.modelcontextprotocol.io/specification/2025-03-26/client/',
  'https://spec.modelcontextprotocol.io/specification/2025-03-26/client/roots/',
  'https://spec.modelcontextprotocol.io/specification/2025-03-26/client/sampling/'
];

// Set up resources request handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: resources
  };
});

// Helper function to fetch and extract the main content from a URL
async function fetchMainContent(url: string): Promise<string> {
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Use JSDOM to parse the HTML and extract the main element
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM(html);
    const mainElement = dom.window.document.querySelector('main');
    
    if (!mainElement) {
      throw new Error(`No main element found in ${url}`);
    }
    
    // Add a section title for each page (except the first/main page)
    if (url !== baseProtocolUrls[0]) {
      const sectionTitle = dom.window.document.createElement('h2');
      sectionTitle.textContent = `${url.split('/').filter(Boolean).pop() || 'Section'}`;
      sectionTitle.style.marginTop = '2em';
      sectionTitle.style.borderTop = '1px solid #ccc';
      sectionTitle.style.paddingTop = '1em';
      mainElement.insertBefore(sectionTitle, mainElement.firstChild);
    }
    
    return mainElement.outerHTML;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error fetching content from ${url}:`, error);
    return `<div class="error">Failed to load content from ${url}: ${errorMessage}</div>`;
  }
}

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  
  // Determine which resource is being requested and select the appropriate URLs
  let urls: string[] = [];
  let resourceTitle = '';
  
  if (uri === 'https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/') {
    urls = baseProtocolUrls;
    resourceTitle = 'MCP Specification - Base Protocol (Combined)';
  } else if (uri === 'https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/utilities/') {
    urls = utilitiesUrls;
    resourceTitle = 'MCP Specification - Utilities (Combined)';
  } else if (uri === 'https://spec.modelcontextprotocol.io/specification/2025-03-26/server/') {
    urls = serverFeaturesUrls;
    resourceTitle = 'MCP Specification - Server Features (Combined)';
  } else if (uri === 'https://spec.modelcontextprotocol.io/specification/2025-03-26/client/') {
    urls = clientFeaturesUrls;
    resourceTitle = 'MCP Specification - Client Features (Combined)';
  } else {
    throw new McpError(
      ErrorCode.MethodNotFound,
      `Unknown resource: ${uri}`
    );
  }
  
  // We found a supported resource, now fetch and combine the content
  try {
    // Fetch the main page first to get its structure
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(uri);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const baseHtml = await response.text();
    
    // Use JSDOM to parse the HTML
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM(baseHtml);
    const document = dom.window.document;
    
    // Get the original main element as a container
    const mainElement = document.querySelector('main');
    if (!mainElement) {
      throw new Error('No main element found in the base HTML');
    }
    
    // Clear existing content in main element
    mainElement.innerHTML = '';
    
    // Add a title for the combined document
    const titleElement = document.createElement('h1');
    titleElement.textContent = resourceTitle;
    mainElement.appendChild(titleElement);
    
    // Fetch content from all URLs and combine them
    const contentPromises = urls.map(async (url, index) => {
      const content = await fetchMainContent(url);
      
      // For all pages except the first one, we want to add a section divider
      if (index > 0) {
        return `
          <div class="section-divider" style="margin-top: 2em; border-top: 2px solid #eee; padding-top: 1em;">
            <h2>Section: ${url.split('/').filter(Boolean).pop() || 'Additional Content'}</h2>
            ${content}
          </div>
        `;
      }
      return content;
    });
    
    // Wait for all content to be fetched
    const contents = await Promise.all(contentPromises);
    
    // Add all content to the main element
    mainElement.innerHTML = contents.join('\n');
    
    // Get the complete HTML document
    const combinedHtml = dom.serialize();
    
    // Return the combined content
    return {
      contents: [
        {
          uri: uri,
          text: combinedHtml,
          mimeType: 'text/html'
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
