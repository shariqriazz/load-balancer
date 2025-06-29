#!/usr/bin/env node

/**
 * Test RovoDev Chat API
 * 
 * Based on discoveries:
 * - Base URL: https://api.atlassian.com
 * - Auth: Basic Auth (but internally uses ASAP)
 * - Might not use model parameter
 */

const axios = require('axios');

async function testRovoDevChat(email, apiToken) {
  console.log('🔍 Testing RovoDev Chat API');
  console.log(`Email: ${email}`);
  console.log(`Token: ***${apiToken.slice(-4)}\n`);

  const creds = Buffer.from(`${email}:${apiToken}`).toString('base64');
  
  // Test different chat endpoint patterns under api.atlassian.com
  const chatTests = [
    {
      name: 'RovoDev V1 Chat',
      url: 'https://api.atlassian.com/rovodev/v1/chat/completions',
      payload: {
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      }
    },
    {
      name: 'RovoDev V2 Chat',
      url: 'https://api.atlassian.com/rovodev/v2/chat/completions',
      payload: {
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      }
    },
    {
      name: 'RovoDev V1 Chat with Model',
      url: 'https://api.atlassian.com/rovodev/v1/chat/completions',
      payload: {
        model: 'claude-3-5-sonnet',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      }
    },
    {
      name: 'RovoDev V2 Chat with Model',
      url: 'https://api.atlassian.com/rovodev/v2/chat/completions',
      payload: {
        model: 'claude-3-5-sonnet',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      }
    },
    {
      name: 'RovoDev V2 Chat with Claude Model',
      url: 'https://api.atlassian.com/rovodev/v2/chat/completions',
      payload: {
        model: 'claude-sonnet-4',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      }
    },
    {
      name: 'RovoDev V2 Generate',
      url: 'https://api.atlassian.com/rovodev/v2/generate',
      payload: {
        prompt: 'Hello',
        max_tokens: 10
      }
    },
    {
      name: 'RovoDev V2 Complete',
      url: 'https://api.atlassian.com/rovodev/v2/complete',
      payload: {
        prompt: 'Hello',
        max_tokens: 10
      }
    }
  ];

  const results = [];

  for (const test of chatTests) {
    try {
      console.log(`Testing: ${test.name}...`);
      
      const headers = {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'RovoDev-Test/1.0'
      };

      const response = await axios.post(test.url, test.payload, {
        headers,
        timeout: 30000,
        validateStatus: () => true
      });
      
      const result = {
        test: test.name,
        url: test.url,
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
          console.log(`   Response:`, JSON.stringify(response.data, null, 2).slice(0, 200));
        }
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`💥 ERROR: ${test.name} - ${error.message}`);
      if (error.response?.data) {
        console.log(`   Response:`, JSON.stringify(error.response.data, null, 2).slice(0, 200));
      }
      console.log('');
      
      results.push({
        test: test.name,
        url: test.url,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
        success: false
      });
    }
  }

  // Test some other potential endpoints
  console.log('🔍 Testing other RovoDev endpoints...\n');
  
  const otherTests = [
    'https://api.atlassian.com/rovodev/v2/models',
    'https://api.atlassian.com/rovodev/v1/models',
    'https://api.atlassian.com/rovodev/v2/chat',
    'https://api.atlassian.com/rovodev/v1/chat'
  ];

  for (const url of otherTests) {
    try {
      console.log(`Testing GET: ${url}...`);
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Basic ${creds}`,
          'Accept': 'application/json'
        },
        timeout: 10000,
        validateStatus: () => true
      });

      if (response.status < 400) {
        console.log(`✅ SUCCESS: GET ${url} - ${response.status}`);
        console.log(`   Response:`, JSON.stringify(response.data, null, 2).slice(0, 300));
      } else {
        console.log(`❌ FAILED: GET ${url} - ${response.status}`);
      }
      console.log('');
      
    } catch (error) {
      console.log(`💥 ERROR: GET ${url} - ${error.message}\n`);
    }
  }

  // Summary
  const successful = results.filter(r => r.success);
  console.log(`\n📊 Summary: ${successful.length}/${results.length} chat tests successful`);
  
  if (successful.length > 0) {
    console.log('\n✅ Working chat endpoints:');
    successful.forEach(r => {
      console.log(`   ${r.url} - ${r.status}`);
    });
  }

  return results;
}

// Parse command line arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node test-rovodev-chat.js <email> <api-token>');
    process.exit(1);
  }
  
  testRovoDevChat(args[0], args[1]).catch(console.error);
}

module.exports = { testRovoDevChat };