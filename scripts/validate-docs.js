#!/usr/bin/env node

/**
 * 📚 Documentation Structure Validator
 * 
 * Validates all documentation files and links
 */

const fs = require('fs');
const path = require('path');

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

const projectRoot = path.join(__dirname, '..');

// Expected documentation structure
const expectedStructure = {
  root: ['README.md', 'README_EN.md', 'LICENSE'],
  'docs': ['README.md', 'STRUCTURE.md', 'START_GUIDE.md', 'PRODUCTION_CHECKLIST.md', 'SECURITY.md'],
  'docs/changelog': ['CHANGELOG.md', 'CHANGES.md', 'RELEASE_NOTES.md'],
  'docs/configuration': ['ENV_VARIABLES.md'],
  'docs/deployment': ['README.md', 'DOCKER_DEPLOY.md', 'DEPLOY_NODE.md'],
  'docs/guides': ['MIGRATION_GUIDE.md', 'OPTIMIZATION_SUMMARY.md', 'PUSH_TO_GITHUB.md'],
  'docs/security': ['README_SECURITY.md', 'SECURITY_AUDIT.md', 'SECURITY_CHECKLIST.md']
};

let errors = [];
let warnings = [];
let totalFiles = 0;
let validFiles = 0;

// Validate structure
logSection('Documentation Structure Validation');

for (const [dir, files] of Object.entries(expectedStructure)) {
  const fullPath = dir === 'root' ? projectRoot : path.join(projectRoot, dir);
  const displayPath = dir === 'root' ? '/' : `/${dir}`;
  
  log(`\n${displayPath}`, 'cyan');
  
  if (!fs.existsSync(fullPath)) {
    errors.push({
      type: 'missing_directory',
      path: displayPath
    });
    log(`  ✗ Directory not found`, 'red');
    continue;
  }
  
  for (const file of files) {
    totalFiles++;
    const filePath = path.join(fullPath, file);
    
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      log(`  ✓ ${file} (${sizeKB} KB)`, 'green');
      validFiles++;
    } else {
      errors.push({
        type: 'missing_file',
        path: `${displayPath}/${file}`
      });
      log(`  ✗ ${file} - Missing`, 'red');
    }
  }
}

// Check for unexpected files in root
logSection('Root Directory Check');

const rootFiles = fs.readdirSync(projectRoot)
  .filter(f => f.endsWith('.md') && !expectedStructure.root.includes(f));

if (rootFiles.length > 0) {
  log(`\nUnexpected .md files in root:`, 'yellow');
  rootFiles.forEach(f => {
    warnings.push({
      type: 'unexpected_file',
      path: `/${f}`,
      suggestion: 'Should be moved to docs/ subdirectory'
    });
    log(`  ⚠ ${f}`, 'yellow');
  });
} else {
  log(`✓ No unexpected .md files in root`, 'green');
}

// Extract and validate markdown links
logSection('Link Validation');

function extractLinks(content, filePath) {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links = [];
  let match;
  
  while ((match = linkRegex.exec(content)) !== null) {
    const [, text, url] = match;
    // Only check local markdown links
    if (!url.startsWith('http') && !url.startsWith('#') && url.includes('.md')) {
      links.push({ text, url, file: filePath });
    }
  }
  
  return links;
}

function validateLink(link) {
  const { url, file } = link;
  const fileDir = path.dirname(file);
  const targetPath = path.resolve(fileDir, url.split('#')[0]);
  
  if (!fs.existsSync(targetPath)) {
    errors.push({
      type: 'broken_link',
      file: path.relative(projectRoot, file),
      url,
      target: path.relative(projectRoot, targetPath)
    });
    return false;
  }
  return true;
}

const docsToCheck = [
  'README.md',
  'README_EN.md',
  'docs/README.md',
  'docs/STRUCTURE.md'
];

let totalLinks = 0;
let brokenLinks = 0;

docsToCheck.forEach(docPath => {
  const fullPath = path.join(projectRoot, docPath);
  
  if (!fs.existsSync(fullPath)) {
    log(`⊘ ${docPath} not found, skipping`, 'yellow');
    return;
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  const links = extractLinks(content, fullPath);
  
  if (links.length > 0) {
    log(`\n${docPath}: ${links.length} links`, 'cyan');
    
    links.forEach(link => {
      totalLinks++;
      if (validateLink(link)) {
        log(`  ✓ ${link.text} → ${link.url}`, 'green');
      } else {
        brokenLinks++;
        log(`  ✗ ${link.text} → ${link.url}`, 'red');
      }
    });
  }
});

// Summary
logSection('Validation Summary');

console.log('');
log(`Files: ${validFiles}/${totalFiles}`, validFiles === totalFiles ? 'green' : 'red');
log(`Links: ${totalLinks - brokenLinks}/${totalLinks} valid`, brokenLinks === 0 ? 'green' : 'red');
log(`Errors: ${errors.length}`, errors.length === 0 ? 'green' : 'red');
log(`Warnings: ${warnings.length}`, warnings.length === 0 ? 'green' : 'yellow');
console.log('');

// Detailed errors
if (errors.length > 0) {
  logSection('❌ Errors');
  errors.forEach((err, i) => {
    console.log('');
    log(`${i + 1}. ${err.type}`, 'red');
    Object.keys(err).forEach(key => {
      if (key !== 'type') {
        log(`   ${key}: ${err[key]}`, 'yellow');
      }
    });
  });
}

// Detailed warnings
if (warnings.length > 0) {
  logSection('⚠️  Warnings');
  warnings.forEach((warn, i) => {
    console.log('');
    log(`${i + 1}. ${warn.type}`, 'yellow');
    Object.keys(warn).forEach(key => {
      if (key !== 'type') {
        log(`   ${key}: ${warn[key]}`, 'cyan');
      }
    });
  });
}

// Final result
console.log('');
if (errors.length === 0 && warnings.length === 0) {
  logSection('✅ All Validations Passed');
  log('Documentation structure is correct!', 'green');
  process.exit(0);
} else if (errors.length === 0) {
  logSection('⚠️  Validation Passed with Warnings');
  log('Documentation structure is OK, but check warnings above.', 'yellow');
  process.exit(0);
} else {
  logSection('❌ Validation Failed');
  log('Please fix the errors above.', 'red');
  process.exit(1);
}
