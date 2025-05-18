import { fetchLinksList, VERSION, filterUrlsBySection } from './index.js';

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
  const draftUrls = new Set<string>();
  const versionedUrls = new Set<string>();
  const otherUrls = new Set<string>();

  // First pass: identify URL types
  allUrls.forEach(url => {
    if (url === 'MCP') return; // Skip "MCP" entries
    
    // Identify draft URLs
    if (url.includes('/draft/')) {
      draftUrls.add(url);
    }
    
    // Identify versioned URLs
    if (url.match(/\/20\d{2}-\d{2}-\d{2}\//)) {
      versionedUrls.add(url);
    } else if (url !== 'MCP' && !url.includes('/draft/')) {
      otherUrls.add(url);
    }
  });

  // Second pass: group URLs by section
  allUrls.forEach(url => {
    if (url === 'MCP') return; // Skip "MCP" entries
    
    // Skip URLs with different versions (including draft when VERSION is not 'draft')
    if ((url.match(/\/20\d{2}-\d{2}-\d{2}\/|\/draft\//) && !url.includes(`/${VERSION}/`))) {
      return;
    }
    
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

  // Display URL type statistics
  console.log('\n=== URL TYPE STATISTICS ===');
  console.log(`Total URLs: ${allUrls.length}`);
  console.log(`Draft URLs: ${draftUrls.size}`);
  console.log(`Versioned URLs: ${versionedUrls.size}`);
  console.log(`Other URLs: ${otherUrls.size}`);
  
  // Display draft URLs specifically
  console.log('\n=== DRAFT URLS ===');
  if (draftUrls.size > 0) {
    const includedDraftUrls = [...draftUrls].filter(url => matchedUrls.has(url));
    const excludedDraftUrls = [...draftUrls].filter(url => !matchedUrls.has(url));
    
    console.log(`Included draft URLs: ${includedDraftUrls.length}`);
    includedDraftUrls.forEach(url => console.log(`  ✅ ${url}`));
    
    console.log(`\nExcluded draft URLs: ${excludedDraftUrls.length}`);
    excludedDraftUrls.forEach(url => console.log(`  ❌ ${url}`));
    
    if (excludedDraftUrls.length > 0) {
      console.log('\n⚠️ Note: Draft URLs are being excluded by the current filtering logic');
    }
  } else {
    console.log('  None found');
  }

  // Display results by section
  console.log('\n=== URLS BY SECTION ===');
  for (const section of sections) {
    const urls = urlsBySection.get(section) || [];
    if (urls.length > 0) {
      console.log(`\n${section}:`);
      urls.forEach(url => console.log(`  ✅ ${url}`));
    } else {
      console.log(`\n${section}:`);
      console.log('  No matching URLs');
    }
  }

  // Find version-filtered URLs (including draft URLs when VERSION is not 'draft')
  const versionFilteredUrls = allUrls.filter(url => 
    url !== 'MCP' && 
    (url.match(/\/20\d{2}-\d{2}-\d{2}\/|\/draft\//) && !url.includes(`/${VERSION}/`))
  );

  // Find unmatched URLs (excluding version-filtered ones)
  const unmatchedUrls = allUrls.filter(url => 
    url !== 'MCP' && 
    !matchedUrls.has(url) &&
    !(url.match(/\/20\d{2}-\d{2}-\d{2}\/|\/draft\//) && !url.includes(`/${VERSION}/`))
  );

  console.log('\n=== FILTERED URLS ===');
  console.log('\nVersion-filtered URLs:');
  if (versionFilteredUrls.length > 0) {
    versionFilteredUrls.forEach(url => console.log(`  ❌ ${url}`));
    console.log(`\nℹ️ Filtered ${versionFilteredUrls.length} different version URLs`);
  } else {
    console.log('  None - no different version URLs found');
  }

  console.log('\nOther unmatched URLs:');
  if (unmatchedUrls.length > 0) {
    unmatchedUrls.forEach(url => console.log(`  ❌ ${url}`));
    console.error(`\n❌ Found ${unmatchedUrls.length} unmatched URLs`);
    process.exit(1);
  } else if (versionFilteredUrls.length > 0) {
    console.log('  None - all non-versioned URLs are matched');
    console.log(`✅ Test passed (${versionFilteredUrls.length} different version URLs were filtered)`);
  } else {
    console.log('  None - all URLs are matched! ✅');
  }
  
  // Test filterUrlsBySection function directly with a draft URL
  console.log('\n=== TESTING filterUrlsBySection WITH DRAFT URL ===');
  const testDraftUrl = 'https://modelcontextprotocol.io/specification/draft/index.md';
  const testUrls = [...allUrls, testDraftUrl];
  
  // Use type assertion to avoid TypeScript error about comparing non-overlapping types
  const shouldIncludeDraft = (VERSION as string) === 'draft';
  for (const section of sections) {
    const filteredUrls = filterUrlsBySection(testUrls, section);
    const includesDraft = filteredUrls.includes(testDraftUrl);
    const isCorrect = includesDraft === shouldIncludeDraft;
    console.log(`Section "${section}" ${includesDraft ? '✅ includes' : '❌ excludes'} draft URL - ${isCorrect ? '✓ correct' : '✗ incorrect'}`);
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
