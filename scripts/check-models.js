#!/usr/bin/env node

const axios = require('axios');

async function checkModels(email, apiToken) {
  try {
    const creds = Buffer.from(`${email}:${apiToken}`).toString('base64');
    
    const response = await axios.get('https://rovo.atlassian.com/v1/models', {
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('Models Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node check-models.js <email> <api-token>');
    process.exit(1);
  }
  checkModels(args[0], args[1]);
}

module.exports = { checkModels };