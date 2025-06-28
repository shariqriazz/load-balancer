# RovoDev Integration Guide

## Overview

This load balancer now supports **Atlassian RovoDev** as a provider, giving you access to premium Claude Sonnet models through Atlassian's AI Gateway. RovoDev offers advanced Claude models with generous token limits (20M tokens per day per account).

## Supported Models

- **claude-sonnet-4** - Latest Claude Sonnet 4 model (premium)
- **claude-3-7-sonnet** - Claude 3.7 Sonnet model (premium)

These models are only available through RovoDev and offer superior performance compared to standard Claude models.

## Features

### ✅ Complete Implementation
- **Multi-Account Support** - Add multiple RovoDev accounts per profile
- **OAuth-Style Authentication** - Email + API token authentication
- **Token-Based Rate Limiting** - 20M tokens per day per account
- **Intelligent Load Balancing** - Automatic rotation based on token usage
- **Usage Tracking** - Real-time token consumption monitoring
- **Automatic Failover** - Switch accounts when limits are reached
- **Admin Dashboard** - Full UI for managing RovoDev keys

### 🔄 Smart Routing
- **Automatic Detection** - Requests for Sonnet models are automatically routed to RovoDev
- **Profile-Based** - Use different RovoDev accounts for different profiles
- **Fallback Support** - Graceful error handling with detailed error messages

### 📊 Monitoring & Analytics
- **Real-Time Usage** - Track token consumption across all accounts
- **Profile Statistics** - Detailed usage breakdown per profile
- **Health Monitoring** - Test connection and sync usage data
- **Error Tracking** - Comprehensive logging and error reporting

## Setup Guide

### 1. Get RovoDev Access

1. **Sign up** for Atlassian RovoDev (requires Atlassian account)
2. **Generate API Token** from your RovoDev dashboard
3. **Note your email** (determines internal vs external access)

### 2. Add RovoDev Keys

1. Navigate to **RovoDev Keys** in the admin panel
2. Click **Add RovoDev Key**
3. Fill in the form:
   ```
   Profile: default (or your custom profile)
   Email: your-email@domain.com
   API Token: your-rovodev-api-token
   Cloud ID: (optional - your Atlassian Cloud ID)
   Daily Token Limit: 20000000 (20M tokens - default)
   ```
4. Click **Create Key**

The system will automatically test the connection and validate your credentials.

### 3. Using RovoDev Models

Simply make requests to the standard OpenAI-compatible endpoint with RovoDev model names:

```bash
curl -X POST http://localhost:4270/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-master-api-key" \
  -H "X-Profile: default" \
  -d '{
    "model": "claude-sonnet-4",
    "messages": [
      {"role": "user", "content": "Hello from RovoDev!"}
    ]
  }'
```

### 4. Profile Management

You can use different RovoDev accounts for different profiles:

```bash
# Use profile-specific RovoDev keys
curl -X POST http://localhost:4270/api/v1/chat/completions \
  -H "X-Profile: team-a" \
  -d '{"model": "claude-sonnet-4", "messages": [...]}'
```

## API Endpoints

### RovoDev Key Management

```bash
# Get all RovoDev keys
GET /api/admin/rovodev-keys

# Create new RovoDev key
POST /api/admin/rovodev-keys
{
  "profile": "default",
  "email": "user@atlassian.com",
  "apiToken": "your-token",
  "cloudId": "optional-cloud-id",
  "dailyTokenLimit": 20000000
}

# Update RovoDev key
PUT /api/admin/rovodev-keys/{id}
{
  "email": "new-email@domain.com",
  "dailyTokenLimit": 30000000
}

# Delete RovoDev key
DELETE /api/admin/rovodev-keys/{id}

# Test RovoDev key
POST /api/admin/rovodev-keys/test/{id}

# Sync usage data
POST /api/admin/rovodev-keys/sync
{
  "profile": "optional-profile-filter"
}

# Get profile statistics
GET /api/admin/rovodev-keys/stats/{profile}
```

### Model Discovery

RovoDev models are automatically included in the models endpoint:

```bash
GET /api/v1/models
```

Response includes:
```json
{
  "data": [
    {
      "id": "claude-sonnet-4",
      "object": "model",
      "owned_by": "atlassian-rovodev"
    },
    {
      "id": "claude-3-7-sonnet", 
      "object": "model",
      "owned_by": "atlassian-rovodev"
    }
  ]
}
```

## Database Schema

### RovoDev Keys Table
```sql
CREATE TABLE rovodev_keys (
  _id TEXT PRIMARY KEY,
  profile TEXT NOT NULL,
  email TEXT NOT NULL,
  api_token TEXT NOT NULL,
  cloud_id TEXT,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_used TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0,
  daily_tokens_used INTEGER NOT NULL DEFAULT 0,
  daily_token_limit INTEGER NOT NULL DEFAULT 20000000,
  last_reset_date TEXT,
  is_disabled_by_rate_limit BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Enhanced Request Logs
The request_logs table now includes token tracking:
```sql
ALTER TABLE request_logs ADD COLUMN inputTokens INTEGER;
ALTER TABLE request_logs ADD COLUMN outputTokens INTEGER; 
ALTER TABLE request_logs ADD COLUMN totalTokens INTEGER;
```

## Load Balancing Strategy

### Token-Based Selection
1. **Check Daily Reset** - Reset usage if new day
2. **Filter Usable Keys** - Only active keys with remaining tokens
3. **Sort by Remaining Tokens** - Most remaining tokens first
4. **Fallback by Last Used** - Least recently used if tokens equal

### Automatic Rotation
- **Rate Limit Detection** - Automatically disable keys when limits hit
- **Health Monitoring** - Test connections and sync usage periodically
- **Failure Handling** - Disable keys after 5 consecutive failures

## Monitoring & Troubleshooting

### Dashboard Features
- **Real-Time Usage** - See token consumption across all accounts
- **Profile Statistics** - Detailed breakdown per profile
- **Key Health** - Connection status and failure counts
- **Usage Trends** - Track consumption patterns

### Common Issues

#### Authentication Errors
```
Error: RovoDev authentication failed
```
**Solution**: Verify email and API token are correct. Test the key using the "Test" button.

#### Rate Limiting
```
Error: Daily token limit exceeded for RovoDev
```
**Solution**: Add more RovoDev accounts or wait for daily reset (midnight UTC).

#### No Available Keys
```
Error: No available RovoDev keys for this profile
```
**Solution**: Add RovoDev keys for the specified profile or use the "default" profile.

### Logging
All RovoDev requests are logged with:
- Token usage (input/output/total)
- Response times
- Error details
- Key rotation events

## Best Practices

### Account Management
1. **Multiple Accounts** - Add multiple RovoDev accounts for high-volume usage
2. **Profile Separation** - Use different profiles for different teams/projects
3. **Regular Monitoring** - Check usage statistics regularly
4. **Token Limits** - Set appropriate daily limits based on your needs

### Performance Optimization
1. **Connection Pooling** - System automatically manages connections
2. **Usage Sync** - Periodically sync usage data with RovoDev API
3. **Health Checks** - Regular connection testing and failure detection
4. **Smart Routing** - Automatic selection of best available account

### Security
1. **Token Storage** - API tokens are masked in the UI for security
2. **Access Control** - Admin authentication required for key management
3. **Audit Logging** - All operations are logged for audit purposes
4. **Secure Headers** - Proper authentication headers for RovoDev API

## Advanced Configuration

### Custom Token Limits
You can set custom daily token limits per account:
```json
{
  "dailyTokenLimit": 50000000  // 50M tokens for high-volume accounts
}
```

### Profile-Specific Routing
Use the `X-Profile` header to route to specific RovoDev accounts:
```bash
curl -H "X-Profile: team-a" -d '{"model": "claude-sonnet-4", ...}'
```

### Batch Operations
Sync usage for all keys or specific profiles:
```bash
# Sync all keys
POST /api/admin/rovodev-keys/sync

# Sync specific profile
POST /api/admin/rovodev-keys/sync
{"profile": "team-a"}
```

## Integration Architecture

```
Client Request
     ↓
Load Balancer (Next.js)
     ↓
Model Detection (claude-sonnet-4?)
     ↓
RovoDev Provider
     ↓
Key Selection (token-based)
     ↓
Atlassian AI Gateway
     ↓
Claude Sonnet Models
```

## Support

For issues with:
- **RovoDev Access**: Contact Atlassian Support
- **Load Balancer Integration**: Check logs and error messages
- **Performance Issues**: Monitor token usage and add more accounts
- **Authentication Problems**: Verify credentials and test connections

The RovoDev integration provides enterprise-grade access to the latest Claude models with robust load balancing and monitoring capabilities.