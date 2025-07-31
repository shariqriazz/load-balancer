# Google Gemini Load Balancer

A modern NextJS application that serves as a proxy server for Google Gemini AI API, with key management, load balancing, and a beautiful UI. This application allows you to efficiently manage multiple Google AI API keys, automatically rotate between them and to monitor your API usage with detailed statistics.

![Load Balancer](https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ftse2.mm.bing.net%2Fth%3Fid%3DOIP.8qJFfRHJ4w1imQm4ATTdcAHaFl%26pid%3DApi&f=1&ipt=967751466c9cf44b0aa649a4db4edd75c0fba31eeac5b92c314a7c161ab215a1&ipo=images)

Thanks to @SannidhyaSah for his contribution to this application

## Features

- **API Key Management**: Add, remove, and monitor your Google AI API keys
- **Load Balancing**: Automatically rotate between multiple API keys to avoid rate limits
- **Usage Statistics**: Monitor your API usage with detailed charts and metrics
- **Logs Viewer**: View and search through request, error, and key event logs
- **Dark/Light Mode**: Toggle between dark and light themes
- **Single Command Execution**: Run both frontend and backend with a single command
- **Security Features**: Key masking, rate limit handling, and failure detection
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Real-time Monitoring**: Live updates of key status and usage metrics
- **Customizable Settings**: Configure key rotation, rate limits, and more
- **Import/Export Keys**: Backup and restore your API keys via JSON files.
- **Configurable API Endpoint**: Set the target Google Gemini API endpoint directly through the UI.

## Architecture

The Load Balancer is built using Next.js App Router, which allows for a unified application that handles both the frontend UI and backend API routes. The application follows a modern architecture:

- **Frontend**: React with Chakra UI and Tailwind CSS for a responsive and accessible interface
- **Backend**: Next.js API routes that proxy requests to the Google Gemini API
- **State Management**: React Context API and SWR for efficient data fetching
- **Data Storage**: SQLite database (`data/database.db`) for API keys, application settings (including the target API endpoint), and detailed request logs (`request_logs` table). File-based storage for supplementary debugging logs (incoming requests, errors, key events). Statistics are primarily derived from the database.
- **Styling**: Chakra UI with Tailwind CSS for a consistent design system
- **Error Handling**: Comprehensive error logging and monitoring
- **Type Safety**: Full TypeScript implementation

## Prerequisites

- Bun runtime (Recommended)
- Git (for version control)
- A Google AI API key (for testing)

## Installation

Make sure you have Bun installed. Then, clone the repository and install the dependencies:

```bash
# Clone the repository
git clone https://github.com/shariqriazz/load-balancer.git
cd load-balancer

# Install dependencies
bun install
```

## Configuration

The application requires minimal configuration:

1. Create a `.env` file in the project root (or copy from `.env.example`)
2. Set the necessary environment variables. The `.env.example` file provides comments explaining each variable. Here's an example structure:

```env
# Admin Login
# Password to access the admin dashboard
ADMIN_PASSWORD=your_secret_admin_password_here # Example: iwfgQ4Qx3YgCzL4KDO0ZXKB5AQwRXk51
# This password is also used to encrypt sensitive data like session information.

# Optional Admin Login Enforcement
# Set to 'false' to disable the admin login requirement for the entire application.
# Set to 'true' or leave blank to enforce admin login.
REQUIRE_ADMIN_LOGIN=true

# Master API Key for Incoming Requests (Optional)
# If set, this single key MUST be provided as a Bearer token in the Authorization header
# for incoming requests to the /api/v1/chat/completions endpoint.
# This adds an authentication layer to YOUR API endpoint.
# Leave blank to skip this specific incoming authentication check.
MASTER_API_KEY=
```

Note: The application runs on port 4270 by default. If you need to change the port, you can modify it in the package.json scripts.

Note: Google AI API keys and rotation settings are managed through the UI (stored in the `data/database.db` SQLite database), not directly in the `.env` file.

**Important:** While server-level settings like `PORT` and `ADMIN_PASSWORD` are configured in the `.env` file, application behavior settings, including the target Google Gemini API endpoint, are managed through the UI on the **Settings** page.

### Configuring the API Endpoint

This application allows you to specify the base URL for the downstream Google Gemini API service you want to proxy requests to.

1.  Navigate to the **Settings** page in the application UI.
2.  Locate the **API Endpoint Configuration** section.
3.  The default Google AI Studio endpoint is pre-configured, or you can enter a custom Gemini-compatible endpoint.
4.  Click the **Save** button next to the API Endpoint input field.
5.  **Important:** You must also click the main **Save Settings** button at the bottom of the page to persist the changes.

The default endpoint is `https://generativelanguage.googleapis.com/v1beta/openai`. You can revert to this default at any time using the **Reset to Default** button (remember to click **Save Settings** afterwards).

## Recommended Settings

For optimal performance and reliability, we recommend the following configuration:

### API Key Management

- Add at least 5 API keys for proper load balancing
- Keep at least 3 backup keys for failover
- Remove keys that consistently fail or get rate limited

### Performance Settings

- Set key rotation request count to 3-5 requests per key
- Set rate limit cooldown to 60 seconds
- Configure max failure count to 3 before key deactivation
- Enable automatic key rotation

### Monitoring

- Check the dashboard daily for key health
- Review error logs every few days
- Monitor key usage distribution for balance
- Keep track of error rates for each key

### Best Practices

- Regularly rotate your API keys (every 30-90 days)
- Keep your total request count below 80% of your quota
- Save frequently used prompts for consistency
- Tag or label your keys based on their usage (e.g., "production", "testing")

### Resource Management

- Set log retention to 14-30 days to manage storage
- Archive important logs before deletion
- Regularly backup your `data/database.db` file.
- Clean up unused saved prompts periodically

## Running the Application

Development mode with hot reloading:

```bash
# Using Bun (runs on port 4270 by default)
bun dev
```

Production deployment:

```bash
# Build the application
bun build

# Start the production server
bun start
```

The application will be available at http://localhost:4270.

Using PM2 for process management:

```bash
# Ensure pm2 is installed globally
bun install -g pm2

# Start the application using pm2 with bun
pm2 start bun --name google-gemini-load-balancer -- start

# Monitor the application
pm2 list
pm2 logs google-gemini-load-balancer
```

## Security Considerations

1. **API Key Protection**:

   - Keys are stored in the SQLite database (`data/database.db`). Ensure appropriate file system permissions for this file.
   - Keys are masked in the UI and logs
   - Access to the admin panel is protected by the `ADMIN_PASSWORD` set in the `.env` file. This password also encrypts sensitive data.

2. **Rate Limiting**:

   - Built-in rate limit detection
   - Automatic key rotation on rate limits
   - Configurable cooldown periods

3. **Error Handling**:
   - Failed keys are automatically disabled
   - Comprehensive error logging
   - Automatic retry mechanisms

## Using as an API Service

To use this load balancer as an API service for your applications:

1. Start the application and access the UI at http://localhost:4270
2. Go to the "API Keys" section and add your Google AI API keys through the UI
3. In your client application, configure the following:
   - Base URL: `http://localhost:4270/api/v1` (or your deployed URL)
   - Authorization Header:
     - If `MASTER_API_KEY` is set in the server's `.env` file, incoming requests to `/api/v1/chat/completions` **must** include the header `Authorization: Bearer <MASTER_API_KEY>`.
     - If `MASTER_API_KEY` is **not** set (left blank) in the `.env` file, this specific authorization check is skipped. The load balancer will still use its managed Google AI keys for outgoing requests.
   - Model: Will be automatically populated from the available Gemini models

Example configuration in your client:

```javascript
const configuration = {
  baseURL: "http://localhost:4270/api/v1",
  // apiKey: "any-string-works", // If MASTER_API_KEY is not set on server
  // OR
  // headers: { Authorization: "Bearer your_secret_master_key_here" } // If MASTER_API_KEY is set on server
  model: "gemini-pro", // Available Gemini models are shown in the dropdown
};
```

## Development

### Project Structure

```
google-gemini-load-balancer/
├── data/                        # Data storage (ensure this directory is writable by the application)
│   └── database.db            # SQLite database for keys and settings
├── logs/                        # Log files (ensure this directory is writable)
├── scripts/                     # Utility scripts
│   └── generate-env.js        # Script to generate environment configuration
├── public/                      # Static assets
├── src/                         # Source code
│   ├── app/                     # Next.js App Router
│   │   ├── api/                 # API routes
│   │   │   ├── admin/           # Admin API endpoints
│   │   │   │   ├── keys/        # Key management (CRUD, Import, Export)
│   │   │   │   └── cleanup-logs/ # Log cleanup endpoint
│   │   │   ├── logs/            # Logs API endpoint (for viewing file logs)
│   │   │   ├── settings/        # Settings API endpoint
│   │   │   ├── stats/           # Statistics API endpoint (DB-driven)
│   │   │   └── v1/              # Google Gemini API proxy endpoints
│   │   ├── dashboard/           # Dashboard page
│   │   ├── keys/                # Key management page
│   │   ├── logs/                # Logs viewer page
│   │   ├── settings/            # Settings page
│   │   └── stats/               # Statistics page
│   ├── components/              # React components
│   ├── contexts/                # React contexts
│   ├── hooks/                   # Custom React hooks
│   └── lib/                     # Library code
│       ├── models/              # Data models (ApiKey, RequestLog, etc.)
│       ├── services/            # Services
│       └── utils/               # Utility functions
```

### Adding Features

To add new features to the Load Balancer:

1. **Frontend Components**: Add new components in the `src/components` directory
2. **API Routes**: Add new API routes in the `src/app/api` directory
3. **Pages**: Add new pages in the `src/app` directory

### Technology Stack

- **Framework**: Next.js 14+
- **UI Library**: Chakra UI with Tailwind CSS
- **State Management**: React Context API + SWR for data fetching
- **API Communication**: Built-in Next.js API routes + Axios for external calls
- **Charts**: Recharts for usage statistics
- **Database**: SQLite (via `sqlite` and `sqlite3` packages)
- **Concurrency**: `async-mutex`
- **Package Manager**: Bun (Recommended)
- **Styling**: Chakra UI + Tailwind CSS
- **Icons**: React Icons

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC
