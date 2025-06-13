#!/usr/bin/env node

/**
 * Simple test script to verify the MCP EPUB RAG server setup
 * Run with: node test-setup.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    log(`✓ ${description}`, 'green');
    return true;
  } else {
    log(`✗ ${description}`, 'red');
    return false;
  }
}

function checkNodeVersion() {
  try {
    const version = process.version;
    const majorVersion = parseInt(version.slice(1).split('.')[0]);
    
    if (majorVersion >= 18) {
      log(`✓ Node.js version: ${version} (>= 18.0.0)`, 'green');
      return true;
    } else {
      log(`✗ Node.js version: ${version} (requires >= 18.0.0)`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ Could not check Node.js version: ${error.message}`, 'red');
    return false;
  }
}

function checkDependencies() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const nodeModulesExists = fs.existsSync('node_modules');
    
    if (nodeModulesExists) {
      log('✓ Dependencies installed (node_modules exists)', 'green');
      return true;
    } else {
      log('✗ Dependencies not installed (run: npm install)', 'red');
      return false;
    }
  } catch (error) {
    log(`✗ Could not check dependencies: ${error.message}`, 'red');
    return false;
  }
}

function checkBuild() {
  try {
    if (fs.existsSync('dist')) {
      log('✓ Project built (dist directory exists)', 'green');
      return true;
    } else {
      log('✗ Project not built (run: npm run build)', 'yellow');
      return false;
    }
  } catch (error) {
    log(`✗ Could not check build: ${error.message}`, 'red');
    return false;
  }
}

function createSampleDocs() {
  const sampleDir = 'sample-docs';
  
  if (!fs.existsSync(sampleDir)) {
    fs.mkdirSync(sampleDir);
  }
  
  // Create a sample markdown file
  const sampleMd = path.join(sampleDir, 'sample.md');
  if (!fs.existsSync(sampleMd)) {
    const content = `# Sample Document

This is a sample markdown document for testing the MCP EPUB RAG server.

## Introduction

This document contains some sample content that can be used to test the document processing and search functionality.

## Machine Learning

Machine learning is a subset of artificial intelligence that focuses on algorithms and statistical models that computer systems use to perform tasks without explicit instructions.

### Key Concepts

- **Supervised Learning**: Learning with labeled data
- **Unsupervised Learning**: Finding patterns in unlabeled data
- **Reinforcement Learning**: Learning through interaction with an environment

## Natural Language Processing

Natural Language Processing (NLP) is a field of artificial intelligence that gives computers the ability to understand, interpret, and manipulate human language.

### Applications

- Text classification
- Sentiment analysis
- Machine translation
- Question answering systems

## Conclusion

This sample document demonstrates various topics that can be searched and retrieved using the RAG system.
`;
    
    fs.writeFileSync(sampleMd, content);
    log(`✓ Created sample document: ${sampleMd}`, 'green');
  } else {
    log(`✓ Sample document exists: ${sampleMd}`, 'green');
  }
}

function main() {
  log('\n🔍 MCP EPUB RAG Server Setup Check\n', 'blue');
  
  let allChecks = true;
  
  // Check Node.js version
  allChecks &= checkNodeVersion();
  
  // Check required files
  allChecks &= checkFile('package.json', 'package.json exists');
  allChecks &= checkFile('tsconfig.json', 'tsconfig.json exists');
  allChecks &= checkFile('src/index.ts', 'Main source file exists');
  
  // Check dependencies
  allChecks &= checkDependencies();
  
  // Check build
  const buildExists = checkBuild();
  
  // Create sample documents
  log('\n📄 Sample Documents:', 'blue');
  createSampleDocs();
  
  // Summary
  log('\n📋 Setup Summary:', 'blue');
  
  if (allChecks) {
    log('✓ All required components are ready!', 'green');
    
    if (!buildExists) {
      log('\n⚠️  Next steps:', 'yellow');
      log('1. Run: npm run build', 'yellow');
      log('2. Run: npm start (to start the MCP server)', 'yellow');
    } else {
      log('\n🚀 Ready to run:', 'green');
      log('   npm start (to start the MCP server)', 'green');
    }
    
    log('\n📖 Usage:', 'blue');
    log('1. Configure your MCP client to use this server', 'reset');
    log('2. Use the "configure" tool with your document paths', 'reset');
    log('3. Use the "search" tool to find relevant content', 'reset');
    log('\nSee README.md for detailed instructions.', 'reset');
    
  } else {
    log('✗ Some components are missing. Please check the errors above.', 'red');
    log('\n🔧 Common fixes:', 'yellow');
    log('- Run: npm install (to install dependencies)', 'yellow');
    log('- Ensure Node.js version >= 18.0.0', 'yellow');
    log('- Check that all source files are present', 'yellow');
  }
  
  log('\n📚 For more help, see README.md or create an issue on GitHub.\n', 'blue');
}

if (require.main === module) {
  main();
}

module.exports = { checkFile, checkNodeVersion, checkDependencies, checkBuild };