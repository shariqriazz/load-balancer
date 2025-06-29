# Scripts

This directory contains utility scripts for managing the load balancer.

## Database Migration Script

The `migrate-json-to-db.js` script helps migrate data from legacy JSON files to the SQLite database.

### Features

- **Safe Migration**: Migrates data from old `keys.json` and `settings.json` files
- **Preserves existing data**: Won't overwrite existing database entries
- **Transaction-based**: Uses database transactions for data integrity
- **Handles missing fields**: Automatically adds new schema fields

### How to run

```bash
bun run migrate:db
```

## Generate Environment Script

The `generate-env.js` script helps you create a `.env.local` file with the necessary environment variables.

### How to run

```bash
bun run scripts/generate-env.js
```

This will create a `.env.local` file with default values that you can customize for your setup.