#!/usr/bin/env node

/**
 * Test different payload structures for RovoDev
 */

const axios = require('axios');

async function testPayloadStructures(email, apiToken) {
  console.log('🔍 Testing Different Payload Structures');
  console.log(`Email: ${email}`);
  console.log(`Token: ***${apiToken.slice(-4)}\n`);

  const creds = Buffer.from(`${email}:${apiToken}`).toString('base64');
  const url = 'https://api.atlassian.com/rovodev/v2/chat/completions';
  
  // Different payload structures to try
  const payloads = [
    {
      name: 'OpenAI Format',
      data: {
        model: 'claude-3-5-sonnet',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
        temperature: 0.1
      }
    },
    {
      name: 'OpenAI Format No Model',
      data: {
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
        temperature: 0.1
      }
    },
    {
      name: 'Claude Format',
      data: {
        prompt: 'Human: Hello\n\nAssistant:',
        max_tokens_to_sample: 10,
        temperature: 0.1
      }
    },
    {
      name: 'Simple Format',
      data: {
        prompt: 'Hello',
        max_tokens: 10
      }
    },
    {
      name: 'Anthropic Format',
      data: {
        model: 'claude-3-5-sonnet',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hello' }]
      }
    },
    {
      name: 'RovoDev Format Guess 1',
      data: {
        input: 'Hello',
        maxTokens: 10
      }
    },
    {
      name: 'RovoDev Format Guess 2',
      data: {
        query: 'Hello',
        max_response_tokens: 10
      }
    },
    {
      name: 'Minimal',
      data: {
        text: 'Hello'
      }
    }
  ];

  const results = [];

  for (const payload of payloads) {
    try {
      console.log(`Testing: ${payload.name}...`);
      
      const headers = {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'RovoDev-Payload-Test/1.0'
      };

      const response = await axios.post(url, payload.data, {
        headers,
        timeout: 30000,
        validateStatus: () => true
      });
      
      const result = {
        name: payload.name,
        status: response.status,
        success: response.status < 400,
        data: response.data,
        payload: payload.data
      };

      results.push(result);

      if (response.status < 400) {
        console.log(`✅ SUCCESS: ${payload.name} - ${response.status}`);
        console.log(`   Payload:`, JSON.stringify(payload.data, null, 2));
        console.log(`   Response:`, JSON.stringify(response.data, null, 2));
      } else {
        console.log(`❌ FAILED: ${payload.name} - ${response.status}`);
        if (response.data) {
          const dataStr = JSON.stringify(response.data, null, 2);
          console.log(`   Error:`, dataStr.slice(0, 300));
        }
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`💥 ERROR: ${payload.name} - ${error.message}`);
      if (error.response?.data) {
        console.log(`   Response:`, JSON.stringify(error.response.data, null, 2).slice(0, 200));
      }
      console.log('');
      
      results.push({
        name: payload.name,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
        success: false,
        payload: payload.data
      });
    }
  }

  // Summary
  const successful = results.filter(r => r.success);
  console.log(`\n📊 Summary: ${successful.length}/${results.length} payload tests successful`);
  
  if (successful.length > 0) {
    console.log('\n✅ Working payloads:');
    successful.forEach(r => {
      console.log(`   ${r.name} - ${r.status}`);
      console.log(`   Payload: ${JSON.stringify(r.payload)}`);
    });
  } else {
    console.log('\n❌ No working payloads found');
    console.log('\nError patterns:');
    const errorCounts = {};
    results.forEach(r => {
      const errorKey = r.status || 'network_error';
      errorCounts[errorKey] = (errorCounts[errorKey] || 0) + 1;
    });
    Object.entries(errorCounts).forEach(([error, count]) => {
      console.log(`   ${error}: ${count} times`);
    });
  }

  return results;
}

// Parse command line arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node test-rovodev-payload.js <email> <api-token>');
    process.exit(1);
  }
  
  testPayloadStructures(args[0], args[1]).catch(console.error);
}

module.exports = { testPayloadStructures };