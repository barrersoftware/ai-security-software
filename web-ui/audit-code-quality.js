#!/usr/bin/env node

/**
 * Code Quality Audit for v4.3.0
 * 
 * Comprehensive analysis of code quality, security, and stability
 */

const fs = require('fs');
const path = require('path');

const results = {
  issues: [],
  warnings: [],
  passed: [],
  stats: {
    totalFiles: 0,
    totalLines: 0,
    pluginsChecked: 0,
    servicesChecked: 0
  }
};

console.log('\n' + '='.repeat(80));
console.log('🔍 CODE QUALITY AUDIT - v4.3.0');
console.log('='.repeat(80) + '\n');

/**
 * Check for missing error handling
 */
function checkErrorHandling(filePath, content) {
  const lines = content.split('\n');
  let issues = 0;
  
  // Check for async functions without try-catch
  const asyncFuncRegex = /async\s+function\s+(\w+)/g;
  let match;
  
  while ((match = asyncFuncRegex.exec(content)) !== null) {
    const funcName = match[1];
    const funcStart = match.index;
    
    // Look for try-catch within next 50 lines
    const contextStart = Math.max(0, content.lastIndexOf('\n', funcStart));
    const contextEnd = Math.min(content.length, funcStart + 2000);
    const contextCode = content.substring(contextStart, contextEnd);
    
    if (!contextCode.includes('try {') && !contextCode.includes('try{')) {
      issues++;
      results.warnings.push({
        file: path.basename(filePath),
        line: content.substring(0, funcStart).split('\n').length,
        issue: `Async function '${funcName}' may need try-catch`,
        severity: 'medium'
      });
    }
  }
  
  return issues;
}

/**
 * Check for SQL injection risks
 */
function checkSQLInjection(filePath, content) {
  let issues = 0;
  
  // Look for string concatenation in SQL
  const sqlConcatRegex = /\$\{[^}]+\}|['"].*\+.*['"]/g;
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    if (line.includes('db.run') || line.includes('db.get') || line.includes('db.all')) {
      if (sqlConcatRegex.test(line) && !line.includes('?')) {
        issues++;
        results.issues.push({
          file: path.basename(filePath),
          line: index + 1,
          issue: 'Potential SQL injection - use parameterized queries',
          severity: 'high'
        });
      }
    }
  });
  
  return issues;
}

/**
 * Check for input validation
 */
function checkInputValidation(filePath, content) {
  let issues = 0;
  const lines = content.split('\n');
  
  // Look for API endpoints without validation
  lines.forEach((line, index) => {
    if (line.match(/router\.(post|put|patch)/)) {
      // Check if next 20 lines have validation
      const nextLines = lines.slice(index, index + 20).join('\n');
      if (!nextLines.includes('!req.body') && 
          !nextLines.includes('validate') && 
          !nextLines.includes('required')) {
        results.warnings.push({
          file: path.basename(filePath),
          line: index + 1,
          issue: 'API endpoint may need input validation',
          severity: 'medium'
        });
      }
    }
  });
  
  return issues;
}

/**
 * Check for proper logging
 */
function checkLogging(filePath, content) {
  let score = 0;
  
  if (content.includes('this.logger') || content.includes('logger.')) {
    score += 2;
    results.passed.push({
      file: path.basename(filePath),
      check: 'Uses logger service'
    });
  }
  
  if (content.includes('console.log') && !filePath.includes('test-')) {
    results.warnings.push({
      file: path.basename(filePath),
      issue: 'Uses console.log instead of logger',
      severity: 'low'
    });
  }
  
  return score;
}

/**
 * Check for memory leaks
 */
function checkMemoryLeaks(filePath, content) {
  let issues = 0;
  
  // Check for event listeners without cleanup
  if (content.includes('.on(') && !content.includes('.removeListener')) {
    if (!filePath.includes('test-')) {
      results.warnings.push({
        file: path.basename(filePath),
        issue: 'Event listeners may need cleanup',
        severity: 'medium'
      });
    }
  }
  
  // Check for intervals/timeouts without cleanup
  if ((content.includes('setInterval') || content.includes('setTimeout')) && 
      !content.includes('clear')) {
    results.warnings.push({
      file: path.basename(filePath),
      issue: 'Timer may need cleanup',
      severity: 'low'
    });
  }
  
  return issues;
}

/**
 * Audit a single file
 */
function auditFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').length;
  
  results.stats.totalFiles++;
  results.stats.totalLines += lines;
  
  // Run checks
  checkErrorHandling(filePath, content);
  checkSQLInjection(filePath, content);
  checkInputValidation(filePath, content);
  checkLogging(filePath, content);
  checkMemoryLeaks(filePath, content);
}

/**
 * Audit all plugins
 */
function auditPlugins() {
  console.log('📦 Phase 1: Auditing Plugins');
  console.log('-'.repeat(80));
  
  const pluginsDir = path.join(__dirname, 'plugins');
  const plugins = fs.readdirSync(pluginsDir);
  
  plugins.forEach(plugin => {
    const pluginPath = path.join(pluginsDir, plugin);
    const stat = fs.statSync(pluginPath);
    
    if (stat.isDirectory()) {
      results.stats.pluginsChecked++;
      
      // Audit index.js
      const indexPath = path.join(pluginPath, 'index.js');
      if (fs.existsSync(indexPath)) {
        auditFile(indexPath);
      }
      
      // Audit other .js files
      const files = fs.readdirSync(pluginPath).filter(f => f.endsWith('.js'));
      files.forEach(file => {
        if (file !== 'index.js') {
          results.stats.servicesChecked++;
          auditFile(path.join(pluginPath, file));
        }
      });
      
      console.log(`   ✅ ${plugin} (${files.length} files)`);
    }
  });
  
  console.log(`\n   📊 Audited ${results.stats.pluginsChecked} plugins, ${results.stats.servicesChecked} services\n`);
}

/**
 * Generate report
 */
function generateReport() {
  console.log('📊 Phase 2: Analysis Results');
  console.log('-'.repeat(80));
  
  const totalIssues = results.issues.length + results.warnings.length;
  
  if (results.issues.length > 0) {
    console.log(`\n🚨 HIGH SEVERITY ISSUES (${results.issues.length}):`);
    results.issues.forEach(issue => {
      console.log(`   ${issue.file}:${issue.line} - ${issue.issue}`);
    });
  }
  
  if (results.warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${results.warnings.length}):`);
    // Show only first 10 warnings
    results.warnings.slice(0, 10).forEach(warning => {
      console.log(`   ${warning.file}:${warning.line || '?'} - ${warning.issue}`);
    });
    if (results.warnings.length > 10) {
      console.log(`   ... and ${results.warnings.length - 10} more warnings`);
    }
  }
  
  console.log(`\n✅ PASSED CHECKS (${results.passed.length}):`);
  const passedByCheck = {};
  results.passed.forEach(p => {
    passedByCheck[p.check] = (passedByCheck[p.check] || 0) + 1;
  });
  Object.entries(passedByCheck).forEach(([check, count]) => {
    console.log(`   ${check}: ${count} files`);
  });
  
  console.log('\n' + '-'.repeat(80));
  console.log('📈 STATISTICS:');
  console.log(`   Total Files: ${results.stats.totalFiles}`);
  console.log(`   Total Lines: ${results.stats.totalLines.toLocaleString()}`);
  console.log(`   Plugins: ${results.stats.pluginsChecked}`);
  console.log(`   Services: ${results.stats.servicesChecked}`);
  console.log(`   High Issues: ${results.issues.length}`);
  console.log(`   Warnings: ${results.warnings.length}`);
  
  console.log('\n' + '='.repeat(80));
  
  if (results.issues.length === 0) {
    console.log('✅ CODE QUALITY: EXCELLENT - No critical issues');
  } else if (results.issues.length < 5) {
    console.log('⚠️  CODE QUALITY: GOOD - Minor issues to fix');
  } else {
    console.log('❌ CODE QUALITY: NEEDS ATTENTION - Multiple issues found');
  }
  
  console.log('='.repeat(80) + '\n');
  
  return results.issues.length === 0;
}

// Run audit
try {
  auditPlugins();
  const passed = generateReport();
  process.exit(passed ? 0 : 1);
} catch (error) {
  console.error('Audit error:', error);
  process.exit(1);
}
