#!/usr/bin/env node

/**
 * 🔍 Environment Variables Validation Script
 * 
 * This script validates that all required environment variables are set
 * and have valid values before starting the application.
 */

const fs = require('fs');
const path = require('path');

// Load .env file
require('dotenv').config();

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('');
  log(`═══════════════════════════════════════`, 'cyan');
  log(`  ${title}`, 'cyan');
  log(`═══════════════════════════════════════`, 'cyan');
}

// Required environment variables
const REQUIRED_VARS = {
  'JWT_SECRET': {
    description: 'JWT signing secret (at least 32 characters)',
    validate: (value) => value && value.length >= 32,
    errorMessage: 'Must be at least 32 characters long',
    generate: 'node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
  },
  'ENCRYPTION_KEY': {
    description: 'Encryption key for Redis data (exactly 32 characters)',
    validate: (value) => value && value.length === 32,
    errorMessage: 'Must be exactly 32 characters long',
    generate: 'node -e "console.log(require(\'crypto\').randomBytes(16).toString(\'hex\'))"'
  }
};

// Optional but recommended variables
const RECOMMENDED_VARS = {
  'PORT': {
    description: 'Server port (default: 3000)',
    validate: (value) => !value || (!isNaN(value) && parseInt(value) > 0 && parseInt(value) < 65536),
    errorMessage: 'Must be a valid port number (1-65535)',
    default: '3000'
  },
  'REDIS_HOST': {
    description: 'Redis server host (default: 127.0.0.1)',
    default: '127.0.0.1'
  },
  'REDIS_PORT': {
    description: 'Redis server port (default: 6379)',
    validate: (value) => !value || (!isNaN(value) && parseInt(value) > 0),
    default: '6379'
  },
  'REDIS_PASSWORD': {
    description: 'Redis password (recommended for production)',
    warning: 'Production deployments should use password-protected Redis'
  },
  'WEB_SESSION_SECRET': {
    description: 'Web session secret (recommended)',
    validate: (value) => !value || value.length >= 16,
    errorMessage: 'Should be at least 16 characters long',
    generate: 'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    warning: 'Using default session secret (not recommended for production)'
  }
};

// Validation results
let errors = [];
let warnings = [];
let info = [];

// Validate required variables
logSection('Required Environment Variables');

for (const [varName, config] of Object.entries(REQUIRED_VARS)) {
  const value = process.env[varName];
  
  if (!value) {
    errors.push({
      variable: varName,
      message: `${varName} is not set`,
      fix: config.generate ? `Generate with: ${config.generate}` : null
    });
    log(`✗ ${varName}: MISSING`, 'red');
    log(`  └─ ${config.description}`, 'yellow');
    if (config.generate) {
      log(`  └─ Generate: ${config.generate}`, 'cyan');
    }
  } else if (config.validate && !config.validate(value)) {
    errors.push({
      variable: varName,
      message: `${varName} is invalid: ${config.errorMessage}`,
      fix: config.generate ? `Generate with: ${config.generate}` : null
    });
    log(`✗ ${varName}: INVALID`, 'red');
    log(`  └─ ${config.errorMessage}`, 'yellow');
  } else {
    log(`✓ ${varName}: OK`, 'green');
    log(`  └─ ${config.description}`, 'blue');
  }
}

// Validate recommended variables
logSection('Recommended Environment Variables');

for (const [varName, config] of Object.entries(RECOMMENDED_VARS)) {
  const value = process.env[varName];
  
  if (!value) {
    if (config.warning) {
      warnings.push({
        variable: varName,
        message: config.warning
      });
      log(`⚠ ${varName}: NOT SET`, 'yellow');
      log(`  └─ ${config.description}`, 'blue');
      log(`  └─ ${config.warning}`, 'yellow');
    } else {
      info.push({
        variable: varName,
        message: `${varName} not set, using default: ${config.default}`
      });
      log(`ℹ ${varName}: USING DEFAULT (${config.default})`, 'cyan');
      log(`  └─ ${config.description}`, 'blue');
    }
  } else if (config.validate && !config.validate(value)) {
    warnings.push({
      variable: varName,
      message: `${varName} is invalid: ${config.errorMessage}`
    });
    log(`⚠ ${varName}: INVALID`, 'yellow');
    log(`  └─ ${config.errorMessage}`, 'yellow');
  } else {
    log(`✓ ${varName}: OK`, 'green');
    log(`  └─ ${config.description}`, 'blue');
  }
}

// Check for .env file
logSection('Configuration Files');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  log(`✓ .env file found: ${envPath}`, 'green');
} else {
  warnings.push({
    message: '.env file not found',
    fix: 'Copy .env.example to .env and configure it'
  });
  log(`⚠ .env file not found`, 'yellow');
  log(`  └─ Copy .env.example to .env and configure it`, 'cyan');
}

const configPath = path.join(__dirname, '..', 'config', 'config.js');
if (fs.existsSync(configPath)) {
  log(`✓ config.js found: ${configPath}`, 'green');
} else {
  const examplePath = path.join(__dirname, '..', 'config', 'config.example.js');
  if (fs.existsSync(examplePath)) {
    info.push({
      message: 'config.js not found, but config.example.js exists',
      fix: 'Copy config.example.js to config.js if needed'
    });
    log(`ℹ config.js not found`, 'cyan');
    log(`  └─ config.example.js will be used as fallback`, 'blue');
  }
}

// Summary
logSection('Validation Summary');

console.log('');
log(`Errors:   ${errors.length}`, errors.length > 0 ? 'red' : 'green');
log(`Warnings: ${warnings.length}`, warnings.length > 0 ? 'yellow' : 'green');
log(`Info:     ${info.length}`, 'cyan');
console.log('');

// Exit with appropriate code
if (errors.length > 0) {
  logSection('❌ Validation Failed');
  log('Please fix the errors above before starting the application.', 'red');
  console.log('');
  log('Quick fix:', 'yellow');
  log('1. Copy .env.example to .env', 'cyan');
  log('2. Generate secrets:', 'cyan');
  errors.forEach(error => {
    if (error.fix) {
      log(`   ${error.fix}`, 'cyan');
    }
  });
  log('3. Update .env with the generated values', 'cyan');
  log('4. Run this script again', 'cyan');
  console.log('');
  process.exit(1);
} else if (warnings.length > 0) {
  logSection('⚠️  Validation Passed with Warnings');
  log('The application can start, but you should address the warnings above.', 'yellow');
  console.log('');
  process.exit(0);
} else {
  logSection('✅ Validation Passed');
  log('All environment variables are properly configured!', 'green');
  console.log('');
  process.exit(0);
}
