#!/usr/bin/env node

// Quick test to verify which version is running
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packagePath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));

console.log('MGC ADO Tracker Version Test');
console.log('============================');
console.log('Package version:', pkg.version);
console.log('File location:', __dirname);
console.log('Node version:', process.version);
console.log('============================');
console.log('If Claude Desktop shows v1.0.0, it is NOT using this code!');
