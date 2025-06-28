# Scripts

This directory contains utility scripts for managing the load balancer.

## Import Script

The `import-data.ts` script allows you to import API keys, request logs, and settings from a JSON file.

### Features

- **Preserves existing data**: Won't overwrite existing API keys or settings
- **Handles missing fields**: Automatically adds new schema fields
- **Validates data**: Ensures imported data matches the expected format
- **Safe operation**: Uses database transactions for data integrity

The script ensures all imported data is compatible with the current schema.

## Generate Environment Script

The `generate-env.js` script helps you create a `.env.local` file with the necessary environment variables.

### How to run

```bash
bun run scripts/generate-env.js
```

This will create a `.env.local` file with default values that you can customize for your setup.