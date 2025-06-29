#!/usr/bin/env node

/**
 * Test Chat Completion Endpoints
 * 
 * Tests the most promising chat endpoints found from the exploration
 */

const axios = require('axios');

async function testChatEndpoints(email, apiToken) {
  console.log('🔍 Testing Chat Completion Endpoints');
  console.log(`Email: ${email}`);
  console.log(`Token: ***${apiToken.slice(-4)}\n`);

  // Most promising chat endpoints based on the working model endpoints
  const chatTests = [
    {
      name: 'Rovo V1 Chat',
      url: 'https://rovo.atlassian.com/v1/chat/completions',
      auth: 'basic'
    },
    {
      name: 'Rovo V2 Chat',
      url: 'https://rovo.atlassian.com/v2/chat/completions',
      auth: 'basic'
    },
    {
      name: 'Rovo AI Gateway V1 Chat',
      url: 'https://rovo.atlassian.com/ai-gateway/v1/chat/completions',
      auth: 'basic'
    },
    {
      name: 'Rovo AI Gateway V2 Chat',
      url: 'https://rovo.atlassian.com/ai-gateway/v2/chat/completions',
      auth: 'basic'
    },
    {
      name: 'Rovo RovoDev V1 Chat',
      url: 'https://rovo.atlassian.com/rovodev/v1/chat/completions',
      auth: 'basic'
    },
    {
      name: 'Rovo RovoDev V2 Chat',
      url: 'https://rovo.atlassian.com/rovodev/v2/chat/completions',
      auth: 'basic'
    },
    {
      name: 'Rovo API V1 Chat',
      url: 'https://rovo.atlassian.com/api/v1/chat/completions',
      auth: 'basic'
    },
    {
      name: 'Rovo API V2 Chat',
      url: 'https://rovo.atlassian.com/api/v2/chat/completions',
      auth: 'basic'
    }
  ];

  const results = [];

  for (const test of chatTests) {
    try {
      console.log(`Testing: ${test.name}...`);
      
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'RovoDev-Chat-Test/1.0'
      };

      if (test.auth === 'basic') {
        const creds = Buffer.from(`${email}:${apiToken}`).toString('base64');
        headers['Authorization'] = `Basic ${creds}`;
      } else if (test.auth === 'bearer') {
        headers['Authorization'] = `Bearer ${apiToken}`;
      }

      const testPayload = {
        model: 'claude-3-5-sonnet',
        messages: [
          { role: 'user', content: 'Hello! This is a test message. Please respond with just "Hello back!"' }
        ],
        max_tokens: 20,
        temperature: 0.1
      };

      const response = await axios.post(test.url, testPayload, {
        headers,
        timeout: 30000,
        validateStatus: () => true
      });
      
      const result = {
        test: test.name,
        url: test.url,
        auth: test.auth,
        status: response.status,
        success: response.status < 400,
        data: response.data,
        headers: response.headers
      };

      results.push(result);

      if (response.status < 400) {
        console.log(`✅ SUCCESS: ${test.name} - ${response.status}`);
        console.log(`   Response:`, JSON.stringify(response.data, null, 2));
      } else {
        console.log(`❌ FAILED: ${test.name} - ${response.status}`);
        if (response.data?.error) {
          console.log(`   Error:`, response.data.error);
        } else if (response.data) {
          console.log(`   Response:`, JSON.stringify(response.data, null, 2).slice(0, 300));
        }
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`💥 ERROR: ${test.name} - ${error.message}`);
      if (error.response?.data) {
        console.log(`   Response:`, JSON.stringify(error.response.data, null, 2).slice(0, 300));
      }
      console.log('');
      
      results.push({
        test: test.name,
        url: test.url,
        auth: test.auth,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
        success: false
      });
    }
  }

  // Summary
  const successful = results.filter(r => r.success);
  console.log(`\n📊 Summary: ${successful.length}/${results.length} chat endpoints successful`);
  
  if (successful.length > 0) {
    console.log('\n✅ Working chat endpoints:');
    successful.forEach(r => {
      console.log(`   ${r.url} (${r.auth}) - ${r.status}`);
    });
  }

  return results;
}

// Parse command line arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node test-chat-endpoints.js <email> <api-token>');
    process.exit(1);
  }
  
  testChatEndpoints(args[0], args[1]).catch(console.error);
}

module.exports = { testChatEndpoints };