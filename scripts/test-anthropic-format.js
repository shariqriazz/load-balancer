#!/usr/bin/env node

/**
 * Test RovoDev with Anthropic API Format
 * 
 * Based on reverse engineering findings:
 * - Uses Anthropic models: claude-sonnet-4@20250514, claude-3-5-sonnet-v2@20241022
 * - Uses Bedrock models: anthropic.claude-3-7-sonnet-20250219-v1:0
 * - Might use Anthropic API format instead of OpenAI format
 */

const axios = require('axios');

async function testAnthropicFormat(email, apiToken) {
  console.log('🔍 Testing RovoDev with Anthropic API Format');
  console.log(`Email: ${email}`);
  console.log(`Token: ***${apiToken.slice(-4)}\n`);

  const creds = Buffer.from(`${email}:${apiToken}`).toString('base64');
  const headers = {
    'Authorization': `Basic ${creds}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'RovoDev-Anthropic-Test/1.0',
    'anthropic-version': '2023-06-01'
  };

  // Discovered model IDs from reverse engineering
  const models = [
    'claude-sonnet-4@20250514',
    'claude-3-7-sonnet-20250219-v1',
    'claude-3-5-sonnet-v2@20241022',
    'claude-3-5-sonnet-20241022-v2',
    // With prefixes
    'anthropic:claude-sonnet-4@20250514',
    'anthropic:claude-3-5-sonnet-v2@20241022',
    'bedrock:anthropic.claude-3-7-sonnet-20250219-v1:0',
    'bedrock:anthropic.claude-3-5-sonnet-20241022-v2:0'
  ];

  // Anthropic API format endpoints to test
  const endpoints = [
    'https://api.atlassian.com/rovodev/v2/messages',
    'https://api.atlassian.com/rovodev/v2/complete',
    'https://api.atlassian.com/rovodev/v1/messages',
    'https://api.atlassian.com/rovodev/v1/complete',
    // Maybe it's proxying to anthropic directly
    'https://api.atlassian.com/anthropic/v1/messages',
    'https://api.atlassian.com/anthropic/v1/complete',
    // Or maybe it's under ai-gateway
    'https://api.atlassian.com/ai-gateway/v1/messages',
    'https://api.atlassian.com/ai-gateway/v1/complete',
  ];

  for (const endpoint of endpoints) {
    for (const model of models.slice(0, 4)) { // Test first 4 models
      try {
        console.log(`Testing: ${endpoint.split('/').slice(-2).join('/')} with model ${model}...`);
        
        // Anthropic API format
        const anthropicPayload = {
          model: model,
          max_tokens: 10,
          messages: [
            { role: 'user', content: 'Hello' }
          ]
        };

        const response = await axios.post(endpoint, anthropicPayload, {
          headers,
          timeout: 15000,
          validateStatus: () => true
        });

        if (response.status < 400) {
          console.log(`🎉 SUCCESS: ${endpoint} with model ${model} - ${response.status}`);
          console.log(`📤 Payload:`, JSON.stringify(anthropicPayload, null, 2));
          console.log(`📥 Response:`, JSON.stringify(response.data, null, 2));
          console.log('\n' + '='.repeat(80) + '\n');
          return { endpoint, model, payload: anthropicPayload, response: response.data };
        } else if (response.status === 404) {
          console.log(`❌ Not found: ${response.status}`);
        } else {
          const errorMsg = typeof response.data === 'string' ? 
            response.data.slice(0, 100) : 
            JSON.stringify(response.data).slice(0, 100);
          console.log(`❌ Error: ${response.status} - ${errorMsg}`);
        }
        
      } catch (error) {
        if (error.code === 'ENOTFOUND') {
          console.log(`❌ DNS error`);
        } else {
          console.log(`❌ Request error: ${error.message.slice(0, 50)}`);
        }
      }
    }
  }

  console.log('\n🔍 Testing with different headers...\n');

  // Test with additional headers that might be needed
  const specialHeaders = {
    ...headers,
    'X-API-Key': apiToken,
    'X-User-Email': email,
    'X-Anthropic-Version': '2023-06-01',
    'X-Client-Version': '0.6.8'
  };

  const testEndpoint = 'https://api.atlassian.com/rovodev/v2/messages';
  const testPayload = {
    model: 'claude-3-5-sonnet-v2@20241022',
    max_tokens: 10,
    messages: [{ role: 'user', content: 'Hello' }]
  };

  try {
    console.log('Testing with special headers...');
    const response = await axios.post(testEndpoint, testPayload, {
      headers: specialHeaders,
      timeout: 15000,
      validateStatus: () => true
    });

    if (response.status < 400) {
      console.log(`🎉 SUCCESS with special headers: ${response.status}`);
      console.log(`📥 Response:`, JSON.stringify(response.data, null, 2));
    } else {
      console.log(`❌ Failed with special headers: ${response.status}`);
      console.log(`📥 Error:`, JSON.stringify(response.data, null, 2).slice(0, 200));
    }
  } catch (error) {
    console.log(`❌ Special headers test failed: ${error.message}`);
  }

  console.log('\n❌ No working Anthropic-format endpoints found');
  return null;
}

// Parse command line arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node test-anthropic-format.js <email> <api-token>');
    process.exit(1);
  }
  
  testAnthropicFormat(args[0], args[1]).catch(console.error);
}

module.exports = { testAnthropicFormat };