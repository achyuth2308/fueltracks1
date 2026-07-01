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
  let modified = false;
  
  // Replacements
  // 1. new Date(x).toLocaleDateString('en-GB') -> formatLocalDate(x)
  content = content.replace(/new Date\(([^)]+)\)\.toLocaleDateString\('en-GB'\)/g, 'formatLocalDate($1)');
  
  // 2. new Date(x).toLocaleDateString() -> formatLocalDate(x)
  content = content.replace(/new Date\(([^)]+)\)\.toLocaleDateString\(\)/g, 'formatLocalDate($1)');
  
  // 3. x.toLocaleDateString('en-GB') -> formatLocalDate(x)  (where x is a variable like exp)
  content = content.replace(/([a-zA-Z0-9_]+)\.toLocaleDateString\('en-GB'\)/g, 'formatLocalDate($1)');
  
  // 4. new Date().toLocaleDateString('en-GB').replace(/\//g, '-') -> formatLocalDate(new Date())
  content = content.replace(/new Date\(\)\.toLocaleDateString\('en-GB'\)\.replace\(\/\\\\\/g, '-'\)/g, 'formatLocalDate(new Date())');
  
  // 5. AuditLogs
  content = content.replace(/new Date\(([^)]+)\)\.toLocaleDateString\('en-IN', \{[^\}]+\}\)/g, 'formatLocalDate($1)');
  
  // 6. Topbar
  content = content.replace(/time\.toLocaleDateString\('en-IN', \{[^\}]+\}\)/g, 'formatLocalDate(time)');
  
  if (content !== originalContent) {
    // Need to import formatLocalDate if not present
    if (!content.includes('formatLocalDate')) {
      // Find relative path to src/utils/dateUtils
      const srcDir = path.resolve(__dirname, 'frontend/src');
      const fileDir = path.dirname(filePath);
      let relPath = path.relative(fileDir, path.join(srcDir, 'utils/dateUtils'));
      if (!relPath.startsWith('.')) relPath = './' + relPath;
      relPath = relPath.replace(/\\/g, '/');
      
      // Inject import after last import
      const importMatches = [...content.matchAll(/^import .*;$/gm)];
      if (importMatches.length > 0) {
        const lastImport = importMatches[importMatches.length - 1];
        const insertIndex = lastImport.index + lastImport[0].length;
        content = content.slice(0, insertIndex) + `\nimport { formatLocalDate } from '${relPath}';` + content.slice(insertIndex);
      } else {
        content = `import { formatLocalDate } from '${relPath}';\n` + content;
      }
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

walkDir(path.join(__dirname, 'frontend/src'), processFile);
console.log('Done updating date formats.');
