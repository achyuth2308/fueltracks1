const fs = require('fs');

const files = [
  'frontend/src/pages/admin/VehiclesAdminPage.jsx',
  'frontend/src/pages/admin/GroupsAdminPage.jsx',
  'frontend/src/pages/admin/BillingAdminPage.jsx',
  'frontend/src/pages/admin/UsersAdminPage.jsx',
  'frontend/src/pages/admin/DevicesAdminPage.jsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log('Skipping ' + file + ' because it does not exist');
    return;
  }
  let content = fs.readFileSync(file, 'utf8');

  // 1. Add pastel-page-bg to the main outer div (usually the one with background: '#EEF5F8' or linear-gradient)
  // We'll just replace the exact styles if they exist
  content = content.replace(/background:\s*['"](#EEF5F8|linear-gradient[^'"]*)['"]/g, "/* pastel-page-bg handles this */");
  content = content.replace(/return\s*\(\s*<div\s/g, 'return (\n    <div className="pastel-page-bg" ');

  // 2. Add pastel-table to tables
  content = content.replace(/<table style={{([^}]+)}}>/g, '<table className="pastel-table" style={{$1}}>');
  content = content.replace(/<table className="([^"]+)"/g, '<table className="$1 pastel-table"');
  if (!content.includes('pastel-table')) {
    content = content.replace(/<table/g, '<table className="pastel-table"');
  }

  // 3. Remove inline styles on table headers that set background (for Groups, Vehicles, Users)
  content = content.replace(/<th\s+style={{([^}]*)background:\s*['"][^'"]*['"]([^}]*)}}/g, '<th style={{$1$2}}');
  
  // Also DevicesAdminPage has dynamic background on th
  content = content.replace(/background:\s*i\s*%\s*2\s*===\s*0\s*\?\s*['"][^'"]*['"]\s*:\s*['"][^'"]*['"]/g, '');
  content = content.replace(/color:\s*i\s*%\s*2\s*===\s*0\s*\?\s*['"][^'"]*['"]\s*:\s*['"][^'"]*['"]/g, '');
  
  // Clean up any empty/dangling styles in DevicesAdminPage
  content = content.replace(/,\s*,/g, ',');

  fs.writeFileSync(file, content);
  console.log('Updated ' + file);
});
