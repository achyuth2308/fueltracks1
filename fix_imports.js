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
  
  const usesLocalDate = content.includes('formatLocalDate(');
  const usesLocalTime = content.includes('formatLocalTime(');
  
  if (!usesLocalDate && !usesLocalTime) return;
  
  const hasImportLocalDate = content.includes('formatLocalDate') && content.includes('dateUtils');
  const hasImportLocalTime = content.includes('formatLocalTime') && content.includes('dateUtils');
  
  let needsImport = [];
  if (usesLocalDate && !hasImportLocalDate) needsImport.push('formatLocalDate');
  if (usesLocalTime && !hasImportLocalTime) needsImport.push('formatLocalTime');
  
  if (needsImport.length > 0) {
    const srcDir = path.resolve(__dirname, 'frontend/src');
    const fileDir = path.dirname(filePath);
    let relPath = path.relative(fileDir, path.join(srcDir, 'utils/dateUtils'));
    if (!relPath.startsWith('.')) relPath = './' + relPath;
    relPath = relPath.replace(/\\/g, '/');
    
    const importString = `import { ${needsImport.join(', ')} } from '${relPath}';\n`;
    
    // insert right after the first import React or at top
    if (content.includes("import React")) {
      content = content.replace(/(import React.*?;\r?\n)/, `$1${importString}`);
    } else {
      content = importString + content;
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed missing imports in: ${filePath}`);
  }
}

walkDir(path.join(__dirname, 'frontend/src'), processFile);
console.log('Done fixing missing imports.');
