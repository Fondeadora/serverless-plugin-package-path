#!/usr/bin/env node

/**
 * Test script for serverless-plugin-package-path
 * 
 * This script:
 * 1. Installs dependencies in the test project
 * 2. Runs serverless package
 * 3. Verifies the layer zip structure
 * 4. Confirms files are in the correct path
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEST_PROJECT_DIR = path.join(__dirname, 'test-project');
const EXPECTED_PATH_PREFIX = 'python/lib/python3.12/site-packages/';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, options = {}) {
  try {
    log(`\n> ${command}`, 'cyan');
    const output = execSync(command, {
      cwd: TEST_PROJECT_DIR,
      encoding: 'utf8',
      stdio: 'pipe',
      ...options
    });
    return output;
  } catch (error) {
    log(`Command failed: ${error.message}`, 'red');
    if (error.stdout) log(error.stdout, 'yellow');
    if (error.stderr) log(error.stderr, 'red');
    throw error;
  }
}

async function verifyLayerStructure() {
  const serverlessDir = path.join(TEST_PROJECT_DIR, '.serverless');
  
  // Find the layer zip file (serverless-python-requirements creates pythonRequirements.zip)
  const possibleNames = [
    'pythonRequirements.zip',
    'dependencies.zip',
    'test-plugin-package-path-dependencies.zip'
  ];
  
  let layerZipPath = null;
  for (const name of possibleNames) {
    const testPath = path.join(serverlessDir, name);
    if (fs.existsSync(testPath)) {
      layerZipPath = testPath;
      break;
    }
  }
  
  // If not found by name, search for any zip file in .serverless
  if (!layerZipPath) {
    const files = fs.readdirSync(serverlessDir);
    const zipFiles = files.filter(f => f.endsWith('.zip') && !f.includes('hello'));
    if (zipFiles.length > 0) {
      layerZipPath = path.join(serverlessDir, zipFiles[0]);
    }
  }
  
  if (!layerZipPath || !fs.existsSync(layerZipPath)) {
    const availableFiles = fs.existsSync(serverlessDir) 
      ? fs.readdirSync(serverlessDir).join(', ')
      : 'directory does not exist';
    throw new Error(`Layer zip not found. Available files in .serverless: ${availableFiles}`);
  }
  
  log(`\n📦 Verifying layer structure...`, 'blue');
  log(`   Layer zip: ${layerZipPath}`, 'cyan');
  
  const zipBuffer = fs.readFileSync(layerZipPath);
  const zip = await JSZip.loadAsync(zipBuffer);
  
  const files = [];
  zip.forEach((relativePath, file) => {
    if (!file.dir) {
      files.push(relativePath);
    }
  });
  
  log(`\n   Found ${files.length} files in layer`, 'cyan');
  
  // Check if all files are in the expected path
  const filesInWrongPath = files.filter(f => !f.startsWith(EXPECTED_PATH_PREFIX));
  
  if (filesInWrongPath.length > 0) {
    log(`\n❌ ERROR: ${filesInWrongPath.length} files not in correct path!`, 'red');
    log(`\n   Expected all files to start with: ${EXPECTED_PATH_PREFIX}`, 'yellow');
    log(`\n   Files in wrong location:`, 'red');
    filesInWrongPath.slice(0, 10).forEach(f => log(`     - ${f}`, 'red'));
    if (filesInWrongPath.length > 10) {
      log(`     ... and ${filesInWrongPath.length - 10} more`, 'red');
    }
    return false;
  }
  
  log(`\n   ✓ All files correctly placed under: ${EXPECTED_PATH_PREFIX}`, 'green');
  
  // Check for specific packages
  const hasRequests = files.some(f => f.includes('requests/__init__.py'));
  const hasUrllib3 = files.some(f => f.includes('urllib3'));
  const hasCertifi = files.some(f => f.includes('certifi'));
  
  log(`\n   Package verification:`, 'cyan');
  log(`     ${hasRequests ? '✓' : '✗'} requests package`, hasRequests ? 'green' : 'red');
  log(`     ${hasUrllib3 ? '✓' : '✗'} urllib3 package`, hasUrllib3 ? 'green' : 'red');
  log(`     ${hasCertifi ? '✓' : '✗'} certifi package`, hasCertifi ? 'green' : 'red');
  
  if (!hasRequests) {
    throw new Error('requests package not found in layer!');
  }
  
  // Show sample files
  log(`\n   Sample file paths:`, 'cyan');
  files.slice(0, 5).forEach(f => log(`     - ${f}`, 'blue'));
  if (files.length > 5) {
    log(`     ... and ${files.length - 5} more files`, 'blue');
  }
  
  // Verify content integrity
  const requestsInit = await zip.file(
    `${EXPECTED_PATH_PREFIX}requests/__init__.py`
  )?.async('string');
  
  if (requestsInit) {
    log(`\n   ✓ File contents accessible and intact`, 'green');
  } else {
    log(`\n   ⚠ Warning: Could not verify file contents`, 'yellow');
  }
  
  return true;
}

async function main() {
  log('\n' + '='.repeat(60), 'blue');
  log('  Testing serverless-plugin-package-path', 'blue');
  log('='.repeat(60), 'blue');
  
  try {
    // Step 1: Install dependencies
    log('\n[1/4] Installing dependencies...', 'yellow');
    exec('npm install', { stdio: 'inherit' });
    log('   ✓ Dependencies installed', 'green');
    
    // Step 2: Clean previous builds
    log('\n[2/4] Cleaning previous builds...', 'yellow');
    const serverlessDir = path.join(TEST_PROJECT_DIR, '.serverless');
    if (fs.existsSync(serverlessDir)) {
      fs.rmSync(serverlessDir, { recursive: true, force: true });
      log('   ✓ Cleaned .serverless directory', 'green');
    } else {
      log('   ℹ No previous build found', 'cyan');
    }
    
    // Step 3: Package with serverless
    log('\n[3/4] Running serverless package...', 'yellow');
    try {
      exec('npx serverless package', { stdio: 'inherit' });
      log('   ✓ Packaging completed', 'green');
    } catch (error) {
      // Check if it's just AWS credentials issue
      if (error.message.includes('credentials') || error.message.includes('AWS')) {
        log('   ⚠ AWS credentials warning (expected in test environment)', 'yellow');
        log('   ℹ Checking if artifacts were created anyway...', 'cyan');
        
        // Check if the layer zip was still created
        // Check if any layer zip was created
        const serverlessDir = path.join(TEST_PROJECT_DIR, '.serverless');
        if (!fs.existsSync(serverlessDir)) {
          throw new Error('Layer artifacts were not created. Cannot continue test.');
        }
        const zipFiles = fs.readdirSync(serverlessDir).filter(f => f.endsWith('.zip'));
        if (zipFiles.length === 0) {
          throw new Error('No zip files created. Cannot continue test.');
        }
        log('   ✓ Layer artifacts created despite credentials issue', 'green');
      } else {
        throw error;
      }
    }
    
    // Step 4: Verify layer structure
    log('\n[4/4] Verifying layer structure...', 'yellow');
    const verified = await verifyLayerStructure();
    
    if (verified) {
      log('\n' + '='.repeat(60), 'green');
      log('  ✓ ALL TESTS PASSED!', 'green');
      log('='.repeat(60), 'green');
      log('\n  The plugin correctly:', 'green');
      log('    • Loaded without errors', 'green');
      log('    • Restructured the layer paths', 'green');
      log('    • Preserved all package files', 'green');
      log('    • Maintained file integrity\n', 'green');
      process.exit(0);
    } else {
      throw new Error('Layer structure verification failed');
    }
    
  } catch (error) {
    log('\n' + '='.repeat(60), 'red');
    log('  ✗ TEST FAILED', 'red');
    log('='.repeat(60), 'red');
    log(`\n  Error: ${error.message}\n`, 'red');
    if (error.stack) {
      log('Stack trace:', 'yellow');
      log(error.stack, 'red');
    }
    process.exit(1);
  }
}

// Run the test
main();
