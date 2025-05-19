import { getDb, Settings, DEFAULT_SETTINGS } from '../src/lib/db';

async function migrateSettings() {
  console.log('Starting settings migration...');
  const db = await getDb();
  
  try {
    // Check if the settings table exists and has data
    const settingsRow = await db.get('SELECT id, config FROM settings WHERE id = 1');
    
    if (settingsRow) {
      console.log('Found existing settings, checking for migration needs...');
      const currentSettings = JSON.parse(settingsRow.config);
      
      // Check if enableGoogleGrounding field exists
      if (currentSettings.enableGoogleGrounding === undefined) {
        console.log('enableGoogleGrounding field missing, updating settings...');
        
        // Add the missing field with default value
        const updatedSettings = {
          ...currentSettings,
          enableGoogleGrounding: DEFAULT_SETTINGS.enableGoogleGrounding
        };
        
        // Save the updated settings back to the database
        await db.run(
          'UPDATE settings SET config = ? WHERE id = 1',
          JSON.stringify(updatedSettings)
        );
        
        console.log('Migration complete! Settings updated with enableGoogleGrounding field.');
        console.log('New settings:', updatedSettings);
      } else {
        console.log('Settings already have enableGoogleGrounding field, no migration needed.');
      }
    } else {
      console.log('No existing settings found. Creating default settings...');
      await db.run(
        'INSERT INTO settings (id, config) VALUES (?, ?)',
        1, 
        JSON.stringify(DEFAULT_SETTINGS)
      );
      console.log('Default settings created with enableGoogleGrounding field.');
    }
    
    console.log('Settings migration process completed successfully!');
  } catch (error) {
    console.error('Error during settings migration:', error);
    throw error;
  } finally {
    // Close the database connection
    if (db.close) await db.close();
  }
}

// Run the migration
migrateSettings().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
}); 