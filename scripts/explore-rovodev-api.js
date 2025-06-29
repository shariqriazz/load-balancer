#!/usr/bin/env node

/**
 * RovoDev API Explorer
 * 
 * This script explores RovoDev API endpoints to reverse engineer the correct
 * URLs, authentication methods, and available functionality.
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
  // Will be set via command line arguments
  email: '',
  apiToken: '',
  
  // Base URLs to try
  baseUrls: [
    'https://api.atlassian.com',
    'https://rovodev.atlassian.com',
    'https://ai-gateway.atlassian.com',
    'https://gateway.atlassian.com',
    'https://rovo.atlassian.com'
  ],
  
  // Endpoint patterns to test
  endpointPatterns: [
    // Chat completion endpoints
    '/v1/chat/completions',
    '/v2/chat/completions',
    '/ai-gateway/v1/chat/completions',
    '/ai-gateway/v2/chat/completions',
    '/rovodev/v1/chat/completions',
    '/rovodev/v2/chat/completions',
    '/rovo/v1/chat/completions',
    '/rovo/v2/chat/completions',
    '/api/v1/chat/completions',
    '/api/v2/chat/completions',
    
    // Model endpoints
    '/v1/models',
    '/v2/models',
    '/ai-gateway/v1/models',
    '/ai-gateway/v2/models',
    '/rovodev/v1/models',
    '/rovodev/v2/models',
    '/rovo/v1/models',
    '/rovo/v2/models',
    '/api/v1/models',
    '/api/v2/models',
    
    // Usage/credits endpoints
    '/v1/credits',
    '/v1/credits/check',
    '/v1/usage',
    '/v2/credits',
    '/v2/credits/check',
    '/v2/usage',
    '/rovodev/v1/credits',
    '/rovodev/v1/credits/check',
    '/rovodev/v1/usage',
    '/rovodev/v2/credits',
    '/rovodev/v2/credits/check',
    '/rovodev/v2/usage',
    '/ai-gateway/v1/credits',
    '/ai-gateway/v1/usage',
    '/ai-gateway/v2/credits',
    '/ai-gateway/v2/usage',
    
    // User/account endpoints
    '/v1/user',
    '/v1/account',
    '/v2/user',
    '/v2/account',
    '/rovodev/v1/user',
    '/rovodev/v1/account',
    '/rovodev/v2/user',
    '/rovodev/v2/account',
    
    // Status/health endpoints
    '/health',
    '/status',
    '/v1/health',
    '/v1/status',
    '/v2/health',
    '/v2/status'
  ],
  
  // Authentication methods to try
  authMethods: [
    'basic', // Basic Auth with email:token
    'bearer', // Bearer token
    'api-key', // API Key header
    'custom' // Custom headers
  ]
};

// Results storage
const results = {
  timestamp: new Date().toISOString(),
  config: {
    email: '', // Will be masked
    hasApiToken: false
  },
  successful: [],
  errors: [],
  discoveries: [],
  summary: {}
};

/**
 * Build authentication headers for different methods
 */
function buildAuthHeaders(method, email, apiToken) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'RovoDev-API-Explorer/1.0'
  };

  switch (method) {
    case 'basic':
      const credentials = Buffer.from(`${email}:${apiToken}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
      break;
      
    case 'bearer':
      headers['Authorization'] = `Bearer ${apiToken}`;
      break;
      
    case 'api-key':
      headers['X-API-Key'] = apiToken;
      headers['X-User-Email'] = email;
      break;
      
    case 'custom':
      headers['Authorization'] = `Bearer ${apiToken}`;
      headers['X-User-Email'] = email;
      headers['X-Atlassian-Token'] = apiToken;
      headers['X-RovoDev-Token'] = apiToken;
      break;
  }

  return headers;
}

/**
 * Test a specific endpoint with different authentication methods
 */
async function testEndpoint(baseUrl, endpoint, method = 'GET') {
  const url = `${baseUrl}${endpoint}`;
  
  for (const authMethod of CONFIG.authMethods) {
    try {
      const headers = buildAuthHeaders(authMethod, CONFIG.email, CONFIG.apiToken);
      
      console.log(`Testing ${method} ${url} with ${authMethod} auth...`);
      
      const config = {
        method,
        url,
        headers,
        timeout: 10000,
        validateStatus: () => true // Don't throw on HTTP errors
      };
      
      // For POST requests to chat endpoints, add a test payload
      if (method === 'POST' && endpoint.includes('chat/completions')) {
        config.data = {
          model: 'claude-3-5-sonnet',
          messages: [
            { role: 'user', content: 'Hello, this is a test message.' }
          ],
          max_tokens: 10,
          temperature: 0.1
        };
      }
      
      const response = await axios(config);
      
      const result = {
        method,
        url,
        authMethod,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        timestamp: new Date().toISOString()
      };
      
      if (response.status < 400) {
        console.log(`✅ SUCCESS: ${method} ${url} (${authMethod}) - ${response.status}`);
        results.successful.push(result);
        
        // Check for interesting discoveries
        if (response.data) {
          if (response.data.models || (Array.isArray(response.data) && response.data.length > 0)) {
            results.discoveries.push({
              type: 'models_endpoint',
              url,
              authMethod,
              data: response.data
            });
          }
          
          if (response.data.balance || response.data.credits || response.data.usage) {
            results.discoveries.push({
              type: 'usage_endpoint',
              url,
              authMethod,
              data: response.data
            });
          }
          
          if (response.data.choices || response.data.id) {
            results.discoveries.push({
              type: 'chat_endpoint',
              url,
              authMethod,
              data: response.data
            });
          }
        }
      } else {
        console.log(`❌ ERROR: ${method} ${url} (${authMethod}) - ${response.status} ${response.statusText}`);
        results.errors.push({
          ...result,
          error: response.data || response.statusText
        });
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.log(`💥 EXCEPTION: ${method} ${url} (${authMethod}) - ${error.message}`);
      results.errors.push({
        method,
        url,
        authMethod,
        error: error.message,
        code: error.code,
        timestamp: new Date().toISOString()
      });
    }
  }
}

/**
 * Test models endpoint (usually GET)
 */
async function testModelsEndpoints() {
  console.log('\n🔍 Testing Models Endpoints...');
  
  for (const baseUrl of CONFIG.baseUrls) {
    for (const endpoint of CONFIG.endpointPatterns.filter(e => e.includes('models'))) {
      await testEndpoint(baseUrl, endpoint, 'GET');
    }
  }
}

/**
 * Test usage/credits endpoints (usually GET)
 */
async function testUsageEndpoints() {
  console.log('\n📊 Testing Usage/Credits Endpoints...');
  
  for (const baseUrl of CONFIG.baseUrls) {
    for (const endpoint of CONFIG.endpointPatterns.filter(e => e.includes('credits') || e.includes('usage'))) {
      await testEndpoint(baseUrl, endpoint, 'GET');
    }
  }
}

/**
 * Test chat completion endpoints (POST)
 */
async function testChatEndpoints() {
  console.log('\n💬 Testing Chat Completion Endpoints...');
  
  for (const baseUrl of CONFIG.baseUrls) {
    for (const endpoint of CONFIG.endpointPatterns.filter(e => e.includes('chat/completions'))) {
      await testEndpoint(baseUrl, endpoint, 'POST');
    }
  }
}

/**
 * Test other endpoints (GET)
 */
async function testOtherEndpoints() {
  console.log('\n🔧 Testing Other Endpoints...');
  
  for (const baseUrl of CONFIG.baseUrls) {
    for (const endpoint of CONFIG.endpointPatterns.filter(e => 
      !e.includes('models') && 
      !e.includes('credits') && 
      !e.includes('usage') && 
      !e.includes('chat/completions')
    )) {
      await testEndpoint(baseUrl, endpoint, 'GET');
    }
  }
}

/**
 * Generate summary of findings
 */
function generateSummary() {
  results.summary = {
    totalTests: results.successful.length + results.errors.length,
    successfulTests: results.successful.length,
    failedTests: results.errors.length,
    discoveries: results.discoveries.length,
    workingEndpoints: results.successful.map(r => ({
      url: r.url,
      method: r.method,
      authMethod: r.authMethod,
      status: r.status
    })),
    discoveredFeatures: results.discoveries.map(d => ({
      type: d.type,
      url: d.url,
      authMethod: d.authMethod
    }))
  };
}

/**
 * Save results to files
 */
async function saveResults() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.join(process.cwd(), 'data', 'rovodev-exploration');
  
  try {
    await fs.mkdir(outputDir, { recursive: true });
    
    // Save full results
    const fullResultsPath = path.join(outputDir, `rovodev-api-exploration-${timestamp}.json`);
    await fs.writeFile(fullResultsPath, JSON.stringify(results, null, 2));
    
    // Save summary
    const summaryPath = path.join(outputDir, `rovodev-api-summary-${timestamp}.json`);
    await fs.writeFile(summaryPath, JSON.stringify(results.summary, null, 2));
    
    // Save working endpoints only
    const workingPath = path.join(outputDir, `rovodev-working-endpoints-${timestamp}.json`);
    await fs.writeFile(workingPath, JSON.stringify(results.successful, null, 2));
    
    // Save discoveries
    const discoveriesPath = path.join(outputDir, `rovodev-discoveries-${timestamp}.json`);
    await fs.writeFile(discoveriesPath, JSON.stringify(results.discoveries, null, 2));
    
    console.log(`\n📁 Results saved to:`);
    console.log(`   Full results: ${fullResultsPath}`);
    console.log(`   Summary: ${summaryPath}`);
    console.log(`   Working endpoints: ${workingPath}`);
    console.log(`   Discoveries: ${discoveriesPath}`);
    
  } catch (error) {
    console.error('Failed to save results:', error);
  }
}

/**
 * Main exploration function
 */
async function exploreRovoDevAPI() {
  console.log('🚀 Starting RovoDev API Exploration...');
  console.log(`📧 Email: ${CONFIG.email}`);
  console.log(`🔑 API Token: ${CONFIG.apiToken ? '***' + CONFIG.apiToken.slice(-4) : 'Not provided'}`);
  
  // Mask email in results
  results.config.email = CONFIG.email.replace(/(.{2}).*@/, '$1***@');
  results.config.hasApiToken = !!CONFIG.apiToken;
  
  try {
    await testModelsEndpoints();
    await testUsageEndpoints();
    await testChatEndpoints();
    await testOtherEndpoints();
    
    generateSummary();
    await saveResults();
    
    console.log('\n📋 Exploration Summary:');
    console.log(`   Total tests: ${results.summary.totalTests}`);
    console.log(`   Successful: ${results.summary.successfulTests}`);
    console.log(`   Failed: ${results.summary.failedTests}`);
    console.log(`   Discoveries: ${results.summary.discoveries}`);
    
    if (results.summary.workingEndpoints.length > 0) {
      console.log('\n✅ Working Endpoints Found:');
      results.summary.workingEndpoints.forEach(ep => {
        console.log(`   ${ep.method} ${ep.url} (${ep.authMethod}) - ${ep.status}`);
      });
    }
    
    if (results.summary.discoveredFeatures.length > 0) {
      console.log('\n🎯 Discovered Features:');
      results.summary.discoveredFeatures.forEach(feat => {
        console.log(`   ${feat.type}: ${feat.url} (${feat.authMethod})`);
      });
    }
    
  } catch (error) {
    console.error('Exploration failed:', error);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node explore-rovodev-api.js <email> <api-token>');
    console.log('Example: node explore-rovodev-api.js user@atlassian.com your-api-token');
    process.exit(1);
  }
  
  CONFIG.email = args[0];
  CONFIG.apiToken = args[1];
  
  if (!CONFIG.email || !CONFIG.apiToken) {
    console.error('Error: Both email and API token are required');
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  parseArgs();
  exploreRovoDevAPI().catch(console.error);
}

module.exports = { exploreRovoDevAPI, CONFIG };