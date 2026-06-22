const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walk(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);
    if (stat.isDirectory()) {
      walk(filepath, callback);
    } else if (filepath.endsWith('.jsx') || filepath.endsWith('.js') || filepath.endsWith('.css')) {
      callback(filepath);
    }
  }
}

walk(srcDir, (filepath) => {
  let content = fs.readFileSync(filepath, 'utf8');
  let original = content;

  // 1. Table Header: #F1F5F9
  // Revert my previous orange table header replacement
  content = content.replace(/<tr style=\{\{\s*background:\s*'#f97316',\s*color:\s*'#FFFFFF'\s*\}\}>/gi, "<tr style={{ background: '#F1F5F9', color: '#334155' }}>");
  // Some other table headers might have #f0f9ff or #F8FAFC
  content = content.replace(/<tr style=\{\{\s*background:\s*'#f0f9ff'/gi, "<tr style={{ background: '#F1F5F9'");
  content = content.replace(/<tr style=\{\{\s*background:\s*'#F8FAFC'/gi, "<tr style={{ background: '#F1F5F9'");
  content = content.replace(/background:\s*'#F8FAFC'/gi, "background: '#EEF5F8'"); // F8FAFC was commonly used for page backgrounds

  // 2. Page Background: #EEF5F8
  // Handle the specific linear gradient in DevicesAdminPage and similar
  content = content.replace(/background:\s*'linear-gradient\(to bottom, #f0f9ff 0%, #f0f9ff 50%, #f0f9ff 50%, #f0f9ff 100%\)'/g, "background: '#EEF5F8'");
  content = content.replace(/background:\s*'#f0f9ff'/g, "background: '#EEF5F8'");
  
  // Tailwind page backgrounds if any: bg-slate-50 -> bg-[#EEF5F8]
  content = content.replace(/bg-slate-50/g, 'bg-[#EEF5F8]');
  content = content.replace(/bg-slate-100/g, 'bg-[#F1F5F9]');
  
  // Update table th colors to #334155 if they were white
  content = content.replace(/color:\s*'#FFFFFF'(.*?textTransform:\s*'uppercase')/gi, "color: '#334155'$1");
  
  // 3. Row Background: #FFFFFF
  // Ensure tr backgrounds are transparent or #FFFFFF
  // (Usually they are transparent with white container, but let's make sure we don't do weird hover)
  // Replaces hover '#f0f9ff' -> '#f8fafc' or '#f1f5f9'
  content = content.replace(/e\.currentTarget\.style\.background\s*=\s*'#f0f9ff'/g, "e.currentTarget.style.background = '#F8FAFC'");

  if (content !== original) {
    fs.writeFileSync(filepath, content, 'utf8');
    console.log('Updated: ' + path.relative(srcDir, filepath));
  }
});

console.log('\nColors updated!');
