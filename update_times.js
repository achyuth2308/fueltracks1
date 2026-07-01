const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

function processFile(filePath) {
  if (!filePath.endsWith('.jsx') && !filePath.endsWith('.js')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  // Replacements
  // 1. new Date(x).toLocaleString() -> formatLocalTime(x)
  content = content.replace(/new Date\(([^)]+)\)\.toLocaleString\(\)/g, 'formatLocalTime($1)');
  
  // 2. new Date(x).toLocaleString('en-GB') -> formatLocalTime(x)
  content = content.replace(/new Date\(([^)]+)\)\.toLocaleString\('en-GB'\)/g, 'formatLocalTime($1)');
  
  // 3. new Date().toLocaleString() -> formatLocalTime(new Date())
  content = content.replace(/new Date\(\)\.toLocaleString\(\)/g, 'formatLocalTime(new Date())');
  
  // 4. d.toLocaleString('en-IN', { ... })  where d is a Date. 
  // In AuditLogsAdminPage.jsx, line 64:
  content = content.replace(/d\.toLocaleString\('en-IN',\s*\{[^}]+\}\)/g, 'formatLocalTime(d)');
  
  // 5. x.toLocaleString() for date objects? Only specifically 'new Date(...)' has been caught.
  content = content.replace(/new Date\(([^)]+)\)\.toLocaleString\(\)\.replace\(',', ''\)/g, 'formatLocalTime($1)');
  
  // 6. user.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A'
  // Handled by rule 1.
  
  if (content !== originalContent) {
    // Need to import formatLocalTime if not present
    if (!content.includes('formatLocalTime')) {
      const srcDir = path.resolve(__dirname, 'frontend/src');
      const fileDir = path.dirname(filePath);
      let relPath = path.relative(fileDir, path.join(srcDir, 'utils/dateUtils'));
      if (!relPath.startsWith('.')) relPath = './' + relPath;
      relPath = relPath.replace(/\\/g, '/');
      
      const importMatches = [...content.matchAll(/^import .*;$/gm)];
      if (importMatches.length > 0) {
        const lastImport = importMatches[importMatches.length - 1];
        const insertIndex = lastImport.index + lastImport[0].length;
        content = content.slice(0, insertIndex) + `\nimport { formatLocalTime } from '${relPath}';` + content.slice(insertIndex);
      } else {
        content = `import { formatLocalTime } from '${relPath}';\n` + content;
      }
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

walkDir(path.join(__dirname, 'frontend/src'), processFile);
console.log('Done updating time formats.');
