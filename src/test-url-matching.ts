import { fetchLinksList } from './index.js';

async function testUrlMatching() {
  // Fetch all URLs from llms.txt
  const allUrls = await fetchLinksList();
  console.log(`\nFound ${allUrls.length} total URLs`);
  
  // Define all our section filters
  const sections = [
    // Specification sections
    '/architecture/',
    '/basic/',
    '/basic/utilities/',
    '/server/',
    '/client/',
    '/specification/',
    
    // Documentation sections
    '/quickstart/',
    '/development/',
    '/sdk/',
    '/tutorials/',
    '/docs/concepts/',
    '/docs/tools/',
    
    // Special sections
    'github.com/modelcontextprotocol/',  // SDK repositories
    '^[^/]+\\.md$'  // Top-level docs (no path segments)
  ];
  
  // Group URLs by section
  const urlsBySection = new Map<string, string[]>();
  const matchedUrls = new Set<string>();

  // First pass: group URLs by section
  allUrls.forEach(url => {
    if (url === 'MCP') return; // Skip "MCP" entries
    
    let matched = false;
    for (const section of sections) {
      if (section.startsWith('^')) {
        // Handle regex patterns
        const regex = new RegExp(section);
        const urlPath = url.split('/').pop() || '';
        if (regex.test(urlPath)) {
          urlsBySection.set(section, [...(urlsBySection.get(section) || []), url]);
          matchedUrls.add(url);
          matched = true;
          break;
        }
      } else if (url.includes(section)) {
        urlsBySection.set(section, [...(urlsBySection.get(section) || []), url]);
        matchedUrls.add(url);
        matched = true;
        break;
      }
    }
  });

  // Display results by section
  for (const section of sections) {
    const urls = urlsBySection.get(section) || [];
    if (urls.length > 0) {
      console.log(`\n${section}:`);
      urls.forEach(url => console.log(`  ${url}`));
    }
  }

  // Find unmatched URLs
  const unmatchedUrls = allUrls.filter(url => url !== 'MCP' && !matchedUrls.has(url));
  
  console.log('\nUnmatched URLs:');
  if (unmatchedUrls.length > 0) {
    unmatchedUrls.forEach(url => console.log(`  ${url}`));
    console.error(`\n❌ Found ${unmatchedUrls.length} unmatched URLs`);
    process.exit(1);
  } else {
    console.log('  None - all URLs are matched! ✅');
  }
}

async function cleanup() {
  // Send SIGINT to trigger the process.exit(0) we already have
  process.emit('SIGINT');
}

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  cleanup().then(() => process.exit(1));
});

// Run the test with proper cleanup
testUrlMatching()
  .then(() => cleanup())
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Test failed:', error);
    cleanup().then(() => process.exit(1));
  });
