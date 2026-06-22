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

  // Replace all button/background occurrences of slate gray with orange
  // BUT keep text color uses (color: '#64748b') as gray - only change background: occurrences
  
  // Replace background color usages
  content = content.replace(/background:\s*'#64748b'/g, "background: '#f97316'");
  content = content.replace(/background:\s*"#64748b"/g, 'background: "#f97316"');
  content = content.replace(/background: '#64748B'/g, "background: '#f97316'");
  
  // Replace style.background inline assignments 
  content = content.replace(/style\.background\s*=\s*'#64748b'/g, "style.background = '#f97316'");
  content = content.replace(/style\.background\s*=\s*'#475569'/g, "style.background = '#ea580c'");

  // Replace color/shadow references in button shadows
  content = content.replace(/rgba\(100,\s*116,\s*139,\s*([\d.]+)\)/g, 'rgba(249,115,22,$1)');
  content = content.replace(/rgba\(139,\s*160,\s*181,\s*([\d.]+)\)/g, 'rgba(249,115,22,$1)');

  // Replace tr background headers (table headers that use slate)
  content = content.replace(/<tr style=\{\{ background: '#64748b', color: '#FFFFFF' \}\}>/g, "<tr style={{ background: '#f97316', color: '#FFFFFF' }}>");

  // Replace active sidebar/tab states - background: '#475569' used for active elements
  content = content.replace(/background:\s*'#475569'/g, "background: '#ea580c'");
  content = content.replace(/background:\s*"#475569"/g, 'background: "#ea580c"');

  // Replace hover states for '#3b82f6' active items to orange
  // (the active nav item in OrganizationProfile sidebar which uses #3b82f6)
  // Leave #3b82f6 as is for now since that's the blue active highlight

  if (content !== original) {
    fs.writeFileSync(filepath, content, 'utf8');
    console.log('Updated: ' + path.relative(path.join(__dirname, 'src'), filepath));
  }
});

console.log('\nAll gray buttons converted to light orange!');
