import { fetchLinksList, VERSION, SUPPORTED_VERSIONS, filterUrlsBySection, extractVersionFromUri, getSchemaForVersion } from './index.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

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
    '/community/',           // NEW: SEP Guidelines, Communication, Governance
    '/docs/getting-started/', // NEW: Introduction
    '/docs/learn/',          // NEW: Architecture, Client/Server Concepts  
    '/docs/concepts/',
    '/docs/tools/',
    '/legacy/tools/',        // NEW: Inspector
    '/overview/',            // NEW: Main MCP overview
    '/sdk/',
    '/tutorials/',
    
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
  
  // Test with each supported version
  console.log('\n=== TESTING WITH MULTIPLE VERSIONS ===');
  for (const testVersion of SUPPORTED_VERSIONS) {
    console.log(`\nTesting with version: ${testVersion}`);
    
    // Test filterUrlsBySection with specific version
    const filteredUrls = filterUrlsBySection(allUrls, '/architecture/', testVersion);
    console.log(`Found ${filteredUrls.length} URLs for /architecture/ with version ${testVersion}`);
    filteredUrls.forEach(url => console.log(`  ✅ ${url}`));
  }
  
  // Test version extraction from URIs
  console.log('\n=== TESTING VERSION EXTRACTION ===');
  const validUris = [
    'https://modelcontextprotocol.io/specification/draft/index.md',
    'https://modelcontextprotocol.io/specification/2024-11-05/index.md',
    'https://modelcontextprotocol.io/specification/2025-03-26/index.md',
    'https://modelcontextprotocol.io/docs/index.md' // No version in URI
  ];
  
  const invalidUris = [
    'https://modelcontextprotocol.io/specification/invalid-version/index.md',
    'https://modelcontextprotocol.io/specification/1.0.0/index.md',
    'https://modelcontextprotocol.io/specification/2023-01-01/index.md' // Non-existent version
  ];
  
  // Test valid URIs
  console.log('\nTesting valid URIs:');
  let validTestsPassed = true;
  for (const uri of validUris) {
    try {
      const extractedVersion = extractVersionFromUri(uri);
      console.log(`✅ URI: ${uri} -> Extracted version: ${extractedVersion}`);
    } catch (error) {
      console.error(`❌ ERROR: URI ${uri} should be valid but threw an error:`, error);
      validTestsPassed = false;
    }
  }
  
  // Test invalid URIs
  console.log('\nTesting invalid URIs:');
  let invalidTestsPassed = true;
  for (const uri of invalidUris) {
    try {
      const extractedVersion = extractVersionFromUri(uri);
      console.error(`❌ ERROR: URI ${uri} should throw an error but returned: ${extractedVersion}`);
      invalidTestsPassed = false;
    } catch (error) {
      if (error instanceof McpError) {
        const isCorrectErrorCode = error.code === ErrorCode.InvalidParams;
        const messageIncludesVersions = error.message.includes(SUPPORTED_VERSIONS.join(', '));
        
        if (isCorrectErrorCode && messageIncludesVersions) {
          console.log(`✅ URI: ${uri} -> Correctly threw McpError with code ${error.code}`);
          console.log(`   Message: ${error.message}`);
        } else {
          console.error(`❌ ERROR: URI ${uri} threw McpError but with wrong details:`);
          console.error(`   Expected code ${ErrorCode.InvalidParams}, got ${error.code}`);
          console.error(`   Message includes supported versions: ${messageIncludesVersions}`);
          console.error(`   Message: ${error.message}`);
          invalidTestsPassed = false;
        }
      } else {
        console.error(`❌ ERROR: URI ${uri} threw wrong error type:`, error);
        invalidTestsPassed = false;
      }
    }
  }
  
  if (validTestsPassed && invalidTestsPassed) {
    console.log('\n✅ All version extraction tests passed!');
  } else {
    console.error('\n❌ Some version extraction tests failed!');
    process.exit(1);
  }
  
  // Test getSchemaForVersion function
  console.log('\n=== TESTING getSchemaForVersion FUNCTION ===');
  
  // Test with valid versions
  console.log('\nTesting valid versions:');
  let schemaValidTestsPassed = true;
  for (const version of SUPPORTED_VERSIONS) {
    try {
      // Just call the function to see if it throws, but don't await the result
      // This checks the validation logic without making network requests
      getSchemaForVersion(version);
      console.log(`✅ Version ${version} accepted without error`);
    } catch (error) {
      console.error(`❌ ERROR: Version ${version} should be valid but threw an error:`, error);
      schemaValidTestsPassed = false;
    }
  }
  
  // Test with invalid versions
  console.log('\nTesting invalid versions:');
  let schemaInvalidTestsPassed = true;
  const invalidVersions = ['invalid-version', '1.0.0', '2023-01-01'];
  
  for (const version of invalidVersions) {
    try {
      await getSchemaForVersion(version);
      console.error(`❌ ERROR: Version ${version} should throw an error but didn't`);
      schemaInvalidTestsPassed = false;
    } catch (error) {
      if (error instanceof McpError) {
        const isCorrectErrorCode = error.code === ErrorCode.InvalidParams;
        const messageIncludesVersions = error.message.includes(SUPPORTED_VERSIONS.join(', '));
        
        if (isCorrectErrorCode && messageIncludesVersions) {
          console.log(`✅ Version ${version} -> Correctly threw McpError with code ${error.code}`);
          console.log(`   Message: ${error.message}`);
        } else {
          console.error(`❌ ERROR: Version ${version} threw McpError but with wrong details:`);
          console.error(`   Expected code ${ErrorCode.InvalidParams}, got ${error.code}`);
          console.error(`   Message includes supported versions: ${messageIncludesVersions}`);
          console.error(`   Message: ${error.message}`);
          schemaInvalidTestsPassed = false;
        }
      } else {
        console.error(`❌ ERROR: Version ${version} threw wrong error type:`, error);
        schemaInvalidTestsPassed = false;
      }
    }
  }
  
  if (schemaValidTestsPassed && schemaInvalidTestsPassed) {
    console.log('\n✅ All getSchemaForVersion tests passed!');
  } else {
    console.error('\n❌ Some getSchemaForVersion tests failed!');
    process.exit(1);
  }
  
  // Test resource template URIs
  console.log('\n=== TESTING RESOURCE TEMPLATE URIS ===');
  const templateUris = [
    'https://modelcontextprotocol.io/specification/{version}/index.md',
    'https://modelcontextprotocol.io/specification/{version}/schema.json'
  ];
  
  for (const templateUri of templateUris) {
    for (const version of SUPPORTED_VERSIONS) {
      const resolvedUri = templateUri.replace('{version}', version);
      console.log(`Template: ${templateUri} with version ${version} -> ${resolvedUri}`);
    }
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
