#!/usr/bin/env node

/**
 * Final RovoDev API Test
 * 
 * Based on reverse engineering findings:
 * - Uses Basic Auth with email:token
 * - Credits endpoint works: /rovodev/v2/credits/check
 * - Chat endpoint is unknown but tokens are being consumed
 * - Might use different API structure than OpenAI
 */

const axios = require('axios');

async function finalRovoDevTest(email, apiToken) {
  console.log('🔍 Final RovoDev API Test');
  console.log(`Email: ${email}`);
  console.log(`Token: ***${apiToken.slice(-4)}\n`);

  const creds = Buffer.from(`${email}:${apiToken}`).toString('base64');
  const headers = {
    'Authorization': `Basic ${creds}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'RovoDev-Final-Test/1.0'
  };

  // Test 1: Confirm credits endpoint works
  console.log('✅ Testing confirmed working endpoint...');
  try {
    const response = await axios.get('https://api.atlassian.com/rovodev/v2/credits/check', {
      headers,
      timeout: 10000
    });
    console.log('✅ Credits endpoint works:', response.status);
    console.log('📊 Token usage:', response.data.balance);
    console.log('🔑 Auth type:', response.data.userCreditLimits?.user?.authType);
    console.log('👤 Account ID:', response.data.userCreditLimits?.user?.atlassianAccountId);
  } catch (error) {
    console.log('❌ Credits endpoint failed:', error.message);
    return;
  }

  console.log('\n🔍 Testing potential chat endpoints...\n');

  // Test different endpoint patterns that might work
  const chatEndpoints = [
    // Based on pydantic_ai, might use different structure
    'https://api.atlassian.com/rovodev/v2/generate',
    'https://api.atlassian.com/rovodev/v2/complete',
    'https://api.atlassian.com/rovodev/v2/invoke',
    'https://api.atlassian.com/rovodev/v2/run',
    'https://api.atlassian.com/rovodev/v2/agent',
    'https://api.atlassian.com/rovodev/v2/ai',
    
    // Maybe it's under a different service
    'https://api.atlassian.com/ai-gateway/v1/chat/completions',
    'https://api.atlassian.com/ai-gateway/v2/chat/completions',
    'https://api.atlassian.com/ai/v1/chat/completions',
    'https://api.atlassian.com/ai/v2/chat/completions',
    
    // Maybe it's a direct model endpoint
    'https://api.atlassian.com/rovodev/v2/models/claude-3-5-sonnet/completions',
    'https://api.atlassian.com/rovodev/v2/models/claude-sonnet-4/completions',
  ];

  const payloads = [
    // OpenAI format
    {
      model: 'claude-3-5-sonnet',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 10
    },
    // Simple format
    {
      prompt: 'Hello',
      max_tokens: 10
    },
    // Anthropic format
    {
      model: 'claude-3-5-sonnet',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hello' }]
    }
  ];

  for (const endpoint of chatEndpoints) {
    for (const payload of payloads) {
      try {
        console.log(`Testing: ${endpoint.split('/').slice(-2).join('/')} with ${Object.keys(payload).join(', ')}...`);
        
        const response = await axios.post(endpoint, payload, {
          headers,
          timeout: 15000,
          validateStatus: () => true
        });

        if (response.status < 400) {
          console.log(`🎉 SUCCESS: ${endpoint} - ${response.status}`);
          console.log(`📤 Payload:`, JSON.stringify(payload, null, 2));
          console.log(`📥 Response:`, JSON.stringify(response.data, null, 2));
          console.log('\n' + '='.repeat(80) + '\n');
          return { endpoint, payload, response: response.data };
        } else if (response.status === 404) {
          console.log(`❌ Not found: ${response.status}`);
        } else {
          console.log(`❌ Error: ${response.status} - ${JSON.stringify(response.data).slice(0, 100)}`);
        }
        
      } catch (error) {
        if (error.code === 'ENOTFOUND') {
          console.log(`❌ DNS error: ${error.message}`);
        } else {
          console.log(`❌ Request error: ${error.message}`);
        }
      }
    }
  }

  console.log('\n❌ No working chat endpoints found');
  console.log('\n🤔 Possible reasons:');
  console.log('1. Chat endpoint requires different authentication (OAuth/ASAP tokens)');
  console.log('2. Chat endpoint is on a different domain/service');
  console.log('3. Chat endpoint requires specific headers we haven\'t tried');
  console.log('4. Chat functionality is accessed through a different protocol (WebSocket, gRPC, etc.)');
  
  return null;
}

// Parse command line arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node final-rovodev-test.js <email> <api-token>');
    process.exit(1);
  }
  
  finalRovoDevTest(args[0], args[1]).catch(console.error);
}

module.exports = { finalRovoDevTest };