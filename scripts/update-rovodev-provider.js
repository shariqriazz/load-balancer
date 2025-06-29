#!/usr/bin/env node

/**
 * Update RovoDev Provider
 * 
 * Updates the RovoDev provider based on API exploration results
 */

const fs = require('fs').promises;
const path = require('path');

async function updateProvider(discoveryFile) {
  try {
    // Read discovery results
    const discoveryData = JSON.parse(await fs.readFile(discoveryFile, 'utf8'));
    
    console.log('📖 Reading discovery results...');
    console.log(`Found ${discoveryData.successful?.length || 0} successful endpoints`);
    
    // Find working endpoints
    const workingEndpoints = discoveryData.successful || [];
    const chatEndpoints = workingEndpoints.filter(ep => ep.url.includes('chat/completions'));
    const modelEndpoints = workingEndpoints.filter(ep => ep.url.includes('models'));
    const usageEndpoints = workingEndpoints.filter(ep => ep.url.includes('credits') || ep.url.includes('usage'));
    
    console.log(`💬 Chat endpoints: ${chatEndpoints.length}`);
    console.log(`🤖 Model endpoints: ${modelEndpoints.length}`);
    console.log(`📊 Usage endpoints: ${usageEndpoints.length}`);
    
    if (chatEndpoints.length === 0) {
      console.log('❌ No working chat endpoints found. Cannot update provider.');
      return;
    }
    
    // Extract the best working configuration
    const bestChat = chatEndpoints[0];
    const bestModels = modelEndpoints[0];
    const bestUsage = usageEndpoints[0];
    
    const baseUrl = new URL(bestChat.url).origin;
    const chatPath = new URL(bestChat.url).pathname;
    const modelsPath = bestModels ? new URL(bestModels.url).pathname : '/v1/models';
    const usagePath = bestUsage ? new URL(bestUsage.url).pathname : '/rovodev/v2/credits/check';
    
    console.log('\n🔧 Updating provider with:');
    console.log(`   Base URL: ${baseUrl}`);
    console.log(`   Chat endpoint: ${chatPath}`);
    console.log(`   Models endpoint: ${modelsPath}`);
    console.log(`   Usage endpoint: ${usagePath}`);
    console.log(`   Auth method: ${bestChat.authMethod}`);
    
    // Read current provider
    const providerPath = path.join(process.cwd(), 'src/lib/services/providers/rovodev.ts');
    let providerContent = await fs.readFile(providerPath, 'utf8');
    
    // Update base URL
    providerContent = providerContent.replace(
      /private baseUrl = '[^']*'/,
      `private baseUrl = '${baseUrl}'`
    );
    
    // Update chat endpoint
    providerContent = providerContent.replace(
      /private chatEndpoint = '[^']*'/,
      `private chatEndpoint = '${chatPath}'`
    );
    
    // Update usage endpoint
    providerContent = providerContent.replace(
      /private usageEndpoint = '[^']*'/,
      `private usageEndpoint = '${usagePath}'`
    );
    
    // Update authentication method if needed
    if (bestChat.authMethod === 'bearer') {
      const newAuthMethod = `
  // Build authentication headers for RovoDev API
  private buildHeaders(rovoDevKey: RovoDevKey): Record<string, string> {
    return {
      'Authorization': \`Bearer \${rovoDevKey.apiToken}\`,
      'Content-Type': 'application/json',
      'User-Agent': 'LoadBalancer/1.0 (RovoDev Provider)',
      'Accept': 'application/json',
      'X-User-Email': rovoDevKey.email
    };
  }`;
      
      providerContent = providerContent.replace(
        /\/\/ Build authentication headers for RovoDev API[\s\S]*?}\s*}/,
        newAuthMethod
      );
    }
    
    // Add discovered models if available
    if (bestModels && discoveryData.discoveries) {
      const modelDiscovery = discoveryData.discoveries.find(d => d.type === 'models_endpoint');
      if (modelDiscovery && modelDiscovery.data && modelDiscovery.data.models) {
        const models = modelDiscovery.data.models
          .filter(m => m.id && m.id.includes('claude'))
          .map(m => `'${m.id}'`)
          .join(',\n  ');
        
        if (models) {
          console.log(`🤖 Found models: ${modelDiscovery.data.models.length}`);
          
          const newModelsArray = `export const ROVODEV_MODELS = [
  ${models}
] as const;`;
          
          providerContent = providerContent.replace(
            /export const ROVODEV_MODELS = \[[\s\S]*?\] as const;/,
            newModelsArray
          );
        }
      }
    }
    
    // Create backup
    const backupPath = `${providerPath}.backup.${Date.now()}`;
    await fs.copyFile(providerPath, backupPath);
    console.log(`📁 Backup created: ${backupPath}`);
    
    // Write updated provider
    await fs.writeFile(providerPath, providerContent);
    console.log(`✅ Provider updated: ${providerPath}`);
    
    // Create a summary file
    const summaryPath = path.join(process.cwd(), 'data/rovodev-provider-update.json');
    const summary = {
      timestamp: new Date().toISOString(),
      updates: {
        baseUrl,
        chatEndpoint: chatPath,
        modelsEndpoint: modelsPath,
        usageEndpoint: usagePath,
        authMethod: bestChat.authMethod
      },
      workingEndpoints: {
        chat: chatEndpoints.map(ep => ({ url: ep.url, auth: ep.authMethod, status: ep.status })),
        models: modelEndpoints.map(ep => ({ url: ep.url, auth: ep.authMethod, status: ep.status })),
        usage: usageEndpoints.map(ep => ({ url: ep.url, auth: ep.authMethod, status: ep.status }))
      }
    };
    
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`📊 Update summary saved: ${summaryPath}`);
    
    console.log('\n🎉 Provider update complete!');
    console.log('Next steps:');
    console.log('1. Test the updated provider');
    console.log('2. Restart your development server');
    console.log('3. Try creating a RovoDev key in the admin panel');
    
  } catch (error) {
    console.error('❌ Failed to update provider:', error);
  }
}

// Parse command line arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node update-rovodev-provider.js <discovery-results.json>');
    console.log('Example: node update-rovodev-provider.js data/rovodev-exploration/rovodev-api-exploration-2024-01-01T12-00-00-000Z.json');
    process.exit(1);
  }
  
  updateProvider(args[0]).catch(console.error);
}

module.exports = { updateProvider };