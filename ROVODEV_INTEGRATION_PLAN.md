# RovoDev Integration Plan

## Overview
Add Atlassian RovoDev as a provider in the load balancer to serve Claude Sonnet models through their API gateway.

## What We're Adding

### 1. New Provider: "rovodev"
- **Models**: Claude Sonnet variants available through Atlassian's AI Gateway
- **Authentication**: Email + API Token (OAuth-style but simplified)
- **Endpoint**: `https://api.atlassian.com/rovodev/v2/chat/completions` (estimated)
- **Rate Limiting**: Daily token limits with usage tracking

### 2. Supported Models (Best Guess)
```typescript
const ROVODEV_MODELS = [
  'claude-3-5-sonnet-v2',           // claude-3-5-sonnet-v2@20241022
  'claude-3-5-sonnet-20241022',     // bedrock:anthropic.claude-3-5-sonnet-20241022-v2:0
  'claude-3-7-sonnet',              // bedrock:anthropic.claude-3-7-sonnet-20250219-v1:0
  'claude-sonnet-4'                 // claude-sonnet-4@20250514 (may be internal only)
];
```

### 3. Authentication Flow
```typescript
interface RovoDevKey {
  email: string;           // User's Atlassian email
  apiToken: string;        // User's API token
  cloudId?: string;        // Optional cloud ID
  isInternal?: boolean;    // Derived from @atlassian.com domain
}
```

## Implementation Strategy

### Phase 1: Basic Provider (Minimal Viable)
1. **Add RovoDev Provider Class** (`src/lib/services/providers/rovodev.ts`)
2. **Update API Key Model** to support email + token structure
3. **Add Models to System** in model lists and validation
4. **Basic Request Handler** with authentication headers
5. **Error Handling** for RovoDev-specific errors

### Phase 2: Advanced Features
1. **Usage Tracking** via `/rovodev/v2/credits/check` endpoint
2. **Rate Limiting** based on daily token limits
3. **Fallback Logic** between different Sonnet models
4. **Context Pruning** for 413 errors
5. **Admin Dashboard** for RovoDev key management

### Phase 3: Dynamic Features (If Possible)
1. **Model Discovery** - Try to detect available models per user
2. **Smart Routing** - Route to best available model
3. **Usage Analytics** - Track token consumption patterns

## Technical Implementation

### 1. Provider Structure
```typescript
export class RovoDevProvider extends BaseProvider {
  name = 'rovodev';
  baseUrl = 'https://api.atlassian.com';
  
  async makeRequest(model: string, messages: any[], apiKey: RovoDevKey) {
    const headers = this.buildHeaders(apiKey);
    const endpoint = this.getModelEndpoint(model);
    // Implementation details
  }
  
  private buildHeaders(apiKey: RovoDevKey) {
    // Reverse engineer AI Gateway headers
    return {
      'Authorization': `Bearer ${apiKey.apiToken}`,
      'X-User-Email': apiKey.email,
      'X-Cloud-ID': apiKey.cloudId || 'unknown',
      // Additional headers from nemo.utils.ai_gateway
    };
  }
}
```

### 2. Database Schema Updates
```sql
-- Add columns to api_keys table
ALTER TABLE api_keys ADD COLUMN email TEXT;
ALTER TABLE api_keys ADD COLUMN cloud_id TEXT;
ALTER TABLE api_keys ADD COLUMN is_internal BOOLEAN DEFAULT FALSE;

-- Or create separate rovodev_keys table
CREATE TABLE rovodev_keys (
  id TEXT PRIMARY KEY,
  profile TEXT NOT NULL,
  email TEXT NOT NULL,
  api_token TEXT NOT NULL,
  cloud_id TEXT,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 3. API Endpoints
```typescript
// New endpoints for RovoDev key management
POST /api/admin/keys/rovodev     // Create RovoDev key
PUT  /api/admin/keys/rovodev/:id // Update RovoDev key
GET  /api/admin/keys/rovodev     // List RovoDev keys
```

## Challenges & Solutions

### Challenge 1: Unknown Exact API Structure
**Solution**: 
- Start with OpenAI-compatible format
- Iterate based on error responses
- Use their FastAPI serve endpoints as reference

### Challenge 2: Model Availability Per User
**Solution**:
- Implement static model list initially
- Add dynamic discovery later if possible
- Fallback gracefully when models unavailable

### Challenge 3: Authentication Complexity
**Solution**:
- Simplify to email + token initially
- Add OAuth flow later if needed
- Support both internal and external users

### Challenge 4: Rate Limiting Integration
**Solution**:
- Query `/credits/check` endpoint periodically
- Cache usage data for performance
- Implement circuit breaker for exhausted limits

## Risk Assessment

### High Risk
- **API Changes**: Atlassian may change their internal API
- **Authentication**: Headers might be more complex than expected
- **Model Access**: Some models may be truly internal-only

### Medium Risk
- **Rate Limiting**: Daily limits might be enforced differently
- **Error Handling**: Error formats may differ from OpenAI
- **Performance**: Additional authentication overhead

### Low Risk
- **Basic Integration**: Should work with email + token
- **Fallback Models**: Can always fall back to public models
- **User Experience**: Transparent to end users

## Success Metrics

### Phase 1 Success
- [ ] RovoDev provider loads without errors
- [ ] Can create RovoDev API keys in admin panel
- [ ] Basic model requests work (even if they fail auth)
- [ ] Error handling doesn't crash the system

### Phase 2 Success
- [ ] Successful authentication with real user credentials
- [ ] At least one Sonnet model works end-to-end
- [ ] Usage tracking displays real data
- [ ] Rate limiting prevents over-usage

### Phase 3 Success
- [ ] Multiple Sonnet models available
- [ ] Dynamic model discovery working
- [ ] Smart fallback between models
- [ ] Performance comparable to other providers

## Timeline Estimate

- **Phase 1**: 2-3 days (basic structure)
- **Phase 2**: 3-5 days (working integration)
- **Phase 3**: 5-7 days (advanced features)
- **Total**: 1-2 weeks for full implementation

## Next Steps

1. **Start with Provider Skeleton** - Basic class structure
2. **Add Database Schema** - Support for email + token
3. **Implement Basic Request Flow** - Even if it fails initially
4. **Test with Real Credentials** - Use your RovoDev access
5. **Iterate Based on Responses** - Fix authentication and format issues