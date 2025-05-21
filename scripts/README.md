# Migration Scripts

This directory contains scripts to help with database migrations and data import/export.

## Settings Migration

The `migrate-settings.ts` script updates your database settings to include the new `enableGoogleGrounding` field.

### Usage:

```bash
bun run scripts/migrate-settings.ts
# OR using Yarn
yarn tsx scripts/migrate-settings.ts
```

This script will:
1. Check if your current settings already have the `enableGoogleGrounding` field
2. If not, add the field with a default value of `false`
3. If no settings exist yet, it will create default settings

## Data Import Script

The `import-data.ts` script allows importing data from a JSON file export, including handling schema migrations.

### Usage:

```bash
bun run scripts/import-data.ts path/to/your/export-file.json
# OR using Yarn
yarn tsx scripts/import-data.ts path/to/your/export-file.json
```

This script supports importing:
- API keys
- Request logs
- Settings (with safe merging of configuration)

The script ensures all imported data is compatible with the current schema, including adding the `enableGoogleGrounding` field if it doesn't exist in the imported settings.

### Features:

- Safely merges settings (prioritizing your current settings)
- Adds missing required fields with appropriate defaults
- Uses a SQL transaction for all-or-nothing imports (prevents partial imports)
- Skips logs that reference non-existent API keys
- Avoids duplicate entries

## Common Issues

- **Database Locked**: Make sure the application is not running when you execute these scripts
- **Missing Fields**: The scripts handle missing fields with reasonable defaults
- **Permissions**: Ensure you have write permissions to the database file 