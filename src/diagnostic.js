#!/usr/bin/env node

// Quick diagnostic script to verify MGC ADO Tracker setup

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('MGC ADO Tracker Diagnostic');
console.log('='.repeat(50));
console.log('');

// Check auth module
const authPath = join(__dirname, 'auth', 'auth.js');
const authExists = fs.existsSync(authPath);
console.log(`✓ Auth module: ${authExists ? '✓ Found' : '✗ MISSING'}`);

// Check database directory
const dbDir = join(os.homedir(), '.ado-tracker');
const dbPath = join(dbDir, 'database.db');
const dbExists = fs.existsSync(dbPath);
const dbDirExists = fs.existsSync(dbDir);

console.log(`✓ Database directory: ${dbDirExists ? '✓ Exists' : '✗ Will be created'}`);
console.log(`✓ Database file: ${dbExists ? '✓ Exists' : '✗ Will be created on first run'}`);
console.log(`  Path: ${dbPath}`);

// Check environment variables
const adoOrgUrl = process.env.ADO_ORG_URL;
const adoPat = process.env.ADO_PAT;
const adoProject = process.env.ADO_PROJECT;

console.log('');
console.log('Environment Configuration:');
console.log(`  ADO_ORG_URL: ${adoOrgUrl ? '✓ Set' : '✗ Not set'}`);
console.log(`  ADO_PAT: ${adoPat ? '✓ Set' : '✗ Not set'}`);
console.log(`  ADO_PROJECT: ${adoProject ? '✓ Set' : '✗ Not set'}`);

console.log('');
console.log('='.repeat(50));
console.log('Diagnostic complete!');

if (!authExists) {
  console.error('');
  console.error('ERROR: Auth module is missing!');
  console.error('The server will not start without it.');
  process.exit(1);
}

if (!adoOrgUrl || !adoPat) {
  console.log('');
  console.log('WARNING: Azure DevOps credentials not configured');
  console.log('The server will start but sync features will not work.');
}

console.log('');
console.log('✓ All critical checks passed - server should start successfully');
