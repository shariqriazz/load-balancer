#!/usr/bin/env node

/**
 * RovoDev Endpoint Discovery Script
 * 
 * Systematically tests multiple endpoint patterns to find the actual chat completion endpoint
 * that's consuming the 11,039 tokens we know are being used.
 */

const axios = require('axios');

async function discoverEndpoints(email, apiToken) {
  console.log('🔍 RovoDev Endpoint Discovery');
  console.log(`Email: ${email}`);
  console.log(`Token: ***${apiToken.slice(-4)}\n`);

  const creds = Buffer.from(`${email}:${apiToken}`).toString('base64');
  
  // Base domains to test
  const domains = [
    'https://api.atlassian.com',
    'https://mcp.atlassian.com', 
    'https://ai.atlassian.com',
    'https://gateway.atlassian.com',
    'https://rovo.atlassian.com',
    'https://dev.atlassian.com',
    'https://internal.atlassian.com',
    'https://rovodev.atlassian.com'
  ];

  // Path patterns to test
  const pathPatterns = [
    // Based on reverse engineering findings
    '/rovodev/v1/{endpoint}',
    '/rovodev/v2/{endpoint}',
    '/rovodev/v3/{endpoint}',
    
    // API patterns
    '/api/v1/{endpoint}',
    '/api/v2/{endpoint}',
    '/api/public/v1/{endpoint}',
    '/api/public/v2/{endpoint}',
    '/api/private/v1/{endpoint}',
    '/api/private/v2/{endpoint}',
    
    // AI Gateway patterns
    '/ai-gateway/v1/{endpoint}',
    '/ai-gateway/v2/{endpoint}',
    '/gateway/v1/{endpoint}',
    '/gateway/v2/{endpoint}',
    
    // Anthropic patterns
    '/anthropic/v1/{endpoint}',
    '/anthropic/v2/{endpoint}',
    
    // Model patterns
    '/models/v1/{endpoint}',
    '/models/v2/{endpoint}',
    
    // LLM patterns
    '/llm/v1/{endpoint}',
    '/llm/v2/{endpoint}',
    
    // Nemo patterns (from reverse engineering)
    '/nemo/v1/{endpoint}',
    '/nemo/v2/{endpoint}',
    
    // Direct patterns
    '/{endpoint}',
    '/v1/{endpoint}',
    '/v2/{endpoint}',
    '/v3/{endpoint}'
  ];

  // Endpoint names to test
  const endpoints = [
    // Chat/completion endpoints
    'chat/completions',
    'completions', 
    'messages',
    'chat',
    'complete',
    'generate',
    'invoke',
    'run',
    'execute',
    'request',
    'query',
    
    // Anthropic-style
    'v1/messages',
    'v1/complete',
    
    // Model-specific
    'claude/completions',
    'claude/messages',
    'claude/chat',
    'anthropic/messages',
    'anthropic/complete',
    
    // Proxy patterns
    'proxy/anthropic/v1/messages',
    'proxy/claude/v1/messages',
    'proxy/v1/messages',
    
    // Agent patterns
    'agent/chat',
    'agent/complete',
    'agent/run',
    'agent/invoke'
  ];

  // HTTP methods to test
  const methods = ['POST', 'PUT', 'PATCH'];
  
  // Different payload formats
  const payloads = [
    // OpenAI format
    {
      model: 'claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 5
    },
    // Anthropic format
    {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 5,
      messages: [{ role: 'user', content: 'test' }]
    },
    // Simple format
    {
      prompt: 'test',
      max_tokens: 5
    },
    // Model prefix format
    {
      model: 'anthropic:claude-3-5-sonnet-v2@20241022',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 5
    }
  ];

  const results = {
    working: [],
    interesting: [], // Non-404 responses
    errors: []
  };

  let testCount = 0;
  const totalTests = domains.length * pathPatterns.length * endpoints.length * methods.length;
  
  console.log(`🚀 Starting systematic discovery of ${totalTests} endpoint combinations...\n`);

  for (const domain of domains) {
    console.log(`\n🌐 Testing domain: ${domain}`);
    
    for (const pathPattern of pathPatterns) {
      for (const endpoint of endpoints) {
        const path = pathPattern.replace('{endpoint}', endpoint);
        const url = `${domain}${path}`;
        
        for (const method of methods) {
          testCount++;
          
          // Progress indicator
          if (testCount % 100 === 0) {
            console.log(`📊 Progress: ${testCount}/${totalTests} (${Math.round(testCount/totalTests*100)}%)`);
          }
          
          try {
            // Test with first payload format
            const payload = payloads[0];
            
            const headers = {
              'Authorization': `Basic ${creds}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'User-Agent': 'RovoDev-Discovery/1.0'
            };
            
            // Add anthropic headers for anthropic endpoints
            if (url.includes('anthropic') || url.includes('claude')) {
              headers['anthropic-version'] = '2023-06-01';
            }

            const response = await axios({
              method,
              url,
              data: payload,
              headers,
              timeout: 5000,
              validateStatus: () => true // Don't throw on any status
            });

            if (response.status < 400) {
              console.log(`\n🎉 SUCCESS: ${method} ${url} - ${response.status}`);
              console.log(`📥 Response:`, JSON.stringify(response.data, null, 2).slice(0, 500));
              results.working.push({
                method,
                url,
                status: response.status,
                data: response.data,
                payload
              });
            } else if (response.status !== 404 && response.status !== 405) {
              // Interesting non-404 responses
              if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 500) {
                console.log(`\n🔍 INTERESTING: ${method} ${url} - ${response.status}`);
                console.log(`📥 Response:`, JSON.stringify(response.data, null, 2).slice(0, 200));
                results.interesting.push({
                  method,
                  url,
                  status: response.status,
                  data: response.data,
                  payload
                });
              }
            }
            
          } catch (error) {
            if (error.code === 'ENOTFOUND') {
              // Domain doesn't exist, skip silently
              break; // Skip other endpoints for this domain
            } else if (error.code !== 'ECONNRESET' && error.code !== 'ETIMEDOUT') {
              results.errors.push({
                method,
                url,
                error: error.message
              });
            }
          }
          
          // Small delay to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 DISCOVERY RESULTS');
  console.log('='.repeat(80));
  
  console.log(`\n✅ Working endpoints: ${results.working.length}`);
  results.working.forEach(result => {
    console.log(`   ${result.method} ${result.url} - ${result.status}`);
  });
  
  console.log(`\n🔍 Interesting responses: ${results.interesting.length}`);
  results.interesting.forEach(result => {
    console.log(`   ${result.method} ${result.url} - ${result.status}`);
  });
  
  console.log(`\n❌ Errors: ${results.errors.length}`);
  if (results.errors.length > 0 && results.errors.length < 10) {
    results.errors.forEach(result => {
      console.log(`   ${result.method} ${result.url} - ${result.error}`);
    });
  }

  // Test working endpoints with different payloads
  if (results.working.length > 0) {
    console.log('\n🧪 Testing working endpoints with different payloads...');
    
    for (const workingEndpoint of results.working) {
      for (let i = 1; i < payloads.length; i++) {
        try {
          const response = await axios({
            method: workingEndpoint.method,
            url: workingEndpoint.url,
            data: payloads[i],
            headers: {
              'Authorization': `Basic ${creds}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            timeout: 10000,
            validateStatus: () => true
          });
          
          if (response.status < 400) {
            console.log(`✅ ${workingEndpoint.url} works with payload ${i}: ${response.status}`);
            console.log(`📥 Response:`, JSON.stringify(response.data, null, 2).slice(0, 300));
          }
        } catch (error) {
          // Ignore errors in this phase
        }
      }
    }
  }

  // Save results to file
  const fs = require('fs');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultFile = `data/endpoint-discovery-${timestamp}.json`;
  
  try {
    fs.writeFileSync(resultFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      email: email.replace(/(.{2}).*@/, '$1***@'),
      totalTests: testCount,
      results
    }, null, 2));
    console.log(`\n📁 Results saved to: ${resultFile}`);
  } catch (error) {
    console.log(`\n❌ Failed to save results: ${error.message}`);
  }

  return results;
}

// Parse command line arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node discover-endpoints.js <email> <api-token>');
    console.log('');
    console.log('This script will systematically test thousands of endpoint combinations');
    console.log('to find the actual RovoDev chat completion endpoint.');
    process.exit(1);
  }
  
  discoverEndpoints(args[0], args[1]).catch(console.error);
}

module.exports = { discoverEndpoints };