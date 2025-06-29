#!/usr/bin/env node

/**
 * Quick RovoDev API Test
 * 
 * Tests the most likely endpoints quickly to find working ones
 */

const axios = require('axios');

async function quickTest(email, apiToken) {
  console.log('🔍 Quick RovoDev API Test');
  console.log(`Email: ${email}`);
  console.log(`Token: ***${apiToken.slice(-4)}\n`);

  // Most likely working combinations
  const tests = [
    {
      name: 'Atlassian AI Gateway - Models',
      url: 'https://api.atlassian.com/ai-gateway/v1/models',
      method: 'GET',
      auth: 'basic'
    },
    {
      name: 'Atlassian AI Gateway - Chat',
      url: 'https://api.atlassian.com/ai-gateway/v1/chat/completions',
      method: 'POST',
      auth: 'basic'
    },
    {
      name: 'RovoDev Credits Check',
      url: 'https://api.atlassian.com/rovodev/v2/credits/check',
      method: 'GET',
      auth: 'basic'
    },
    {
      name: 'Alternative AI Gateway',
      url: 'https://ai-gateway.atlassian.com/v1/models',
      method: 'GET',
      auth: 'basic'
    },
    {
      name: 'Bearer Token Test',
      url: 'https://api.atlassian.com/ai-gateway/v1/models',
      method: 'GET',
      auth: 'bearer'
    }
  ];

  const results = [];

  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}...`);
      
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'RovoDev-Quick-Test/1.0'
      };

      if (test.auth === 'basic') {
        const creds = Buffer.from(`${email}:${apiToken}`).toString('base64');
        headers['Authorization'] = `Basic ${creds}`;
      } else if (test.auth === 'bearer') {
        headers['Authorization'] = `Bearer ${apiToken}`;
      }

      const config = {
        method: test.method,
        url: test.url,
        headers,
        timeout: 10000,
        validateStatus: () => true
      };

      if (test.method === 'POST' && test.url.includes('chat')) {
        config.data = {
          model: 'claude-3-5-sonnet',
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 5
        };
      }

      const response = await axios(config);
      
      const result = {
        test: test.name,
        url: test.url,
        method: test.method,
        auth: test.auth,
        status: response.status,
        success: response.status < 400,
        data: response.data
      };

      results.push(result);

      if (response.status < 400) {
        console.log(`✅ SUCCESS: ${test.name} - ${response.status}`);
        if (response.data) {
          console.log(`   Response:`, JSON.stringify(response.data, null, 2).slice(0, 200) + '...');
        }
      } else {
        console.log(`❌ FAILED: ${test.name} - ${response.status}`);
        if (response.data?.error) {
          console.log(`   Error:`, response.data.error);
        }
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`💥 ERROR: ${test.name} - ${error.message}\n`);
      results.push({
        test: test.name,
        url: test.url,
        method: test.method,
        auth: test.auth,
        error: error.message,
        success: false
      });
    }
  }

  // Summary
  const successful = results.filter(r => r.success);
  console.log(`\n📊 Summary: ${successful.length}/${results.length} tests successful`);
  
  if (successful.length > 0) {
    console.log('\n✅ Working endpoints:');
    successful.forEach(r => {
      console.log(`   ${r.method} ${r.url} (${r.auth}) - ${r.status}`);
    });
  }

  return results;
}

// Parse command line arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node test-rovodev-quick.js <email> <api-token>');
    process.exit(1);
  }
  
  quickTest(args[0], args[1]).catch(console.error);
}

module.exports = { quickTest };