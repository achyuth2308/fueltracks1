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
  if (!filePath.endsWith('.jsx')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  if (!content.includes('type="datetime-local"')) return;

  // Replace <input type="datetime-local" ... /> with <CustomDatePicker showTime ... />
  content = content.replace(/<input\s+type="datetime-local"/g, '<CustomDatePicker showTime');
  // Also check if there are any that have type attribute after
  content = content.replace(/<input([^>]*?)type="datetime-local"/g, '<CustomDatePicker showTime$1');

  if (content !== originalContent) {
    if (!content.includes('import CustomDatePicker')) {
      const srcDir = path.resolve(__dirname, 'frontend/src');
      const fileDir = path.dirname(filePath);
      let relPath = path.relative(fileDir, path.join(srcDir, 'components/ui/CustomDatePicker'));
      if (!relPath.startsWith('.')) relPath = './' + relPath;
      relPath = relPath.replace(/\\/g, '/');
      
      const importString = `import CustomDatePicker from '${relPath}';\n`;
      
      if (content.includes("import React")) {
        content = content.replace(/(import React.*?;\r?\n)/, `$1${importString}`);
      } else {
        content = importString + content;
      }
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated datetime inputs in: ${filePath}`);
  }
}

walkDir(path.join(__dirname, 'frontend/src'), processFile);
console.log('Done updating datetime inputs.');
