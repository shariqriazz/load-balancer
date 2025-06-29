/**
 * Environment variable validation and configuration
 */

interface EnvConfig {
  ADMIN_PASSWORD: string;
  REQUIRE_ADMIN_LOGIN: boolean;
  MASTER_API_KEY?: string;
  NODE_ENV: 'development' | 'production' | 'test';
}

function validateEnvVar(name: string, value: string | undefined, required: boolean = true): string {
  if (required && (!value || value.trim() === '')) {
    throw new Error(`Environment variable ${name} is required but not set`);
  }
  return value || '';
}

function validateBoolean(name: string, value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  
  const normalized = value.toLowerCase().trim();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  
  console.warn(`Invalid boolean value for ${name}: ${value}. Using default: ${defaultValue}`);
  return defaultValue;
}

function validateNodeEnv(value: string | undefined): 'development' | 'production' | 'test' {
  const validEnvs = ['development', 'production', 'test'] as const;
  if (value && validEnvs.includes(value as any)) {
    return value as 'development' | 'production' | 'test';
  }
  return 'development';
}

function validateEnvironment(): EnvConfig {
  try {
    const config: EnvConfig = {
      ADMIN_PASSWORD: validateEnvVar('ADMIN_PASSWORD', process.env.ADMIN_PASSWORD, true),
      REQUIRE_ADMIN_LOGIN: validateBoolean('REQUIRE_ADMIN_LOGIN', process.env.REQUIRE_ADMIN_LOGIN, true),
      MASTER_API_KEY: process.env.MASTER_API_KEY,
      NODE_ENV: validateNodeEnv(process.env.NODE_ENV),
    };

    // Additional validation
    if (config.ADMIN_PASSWORD.length < 8) {
      throw new Error('ADMIN_PASSWORD must be at least 8 characters long');
    }

    if (config.NODE_ENV === 'production') {
      if (config.ADMIN_PASSWORD === 'your_secret_admin_password_here') {
        throw new Error('ADMIN_PASSWORD must be changed from default value in production');
      }
      
      if (config.MASTER_API_KEY === 'your_master_api_key_here') {
        console.warn('MASTER_API_KEY is set to default value in production');
      }
    }

    console.log('Environment validation passed');
    return config;
  } catch (error) {
    console.error('Environment validation failed:', error);
    throw error;
  }
}

// Validate environment on module load
export const ENV_CONFIG = validateEnvironment();