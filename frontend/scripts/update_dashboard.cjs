const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/pages/user/DashboardPage.jsx');
let content = fs.readFileSync(targetFile, 'utf8');

if (!content.includes('ManualFuelDashboardSection')) {
  content = content.replace(
    /import CustomerDashboard from '\.\/CustomerDashboard';/,
    "import CustomerDashboard from './CustomerDashboard';\nimport ManualFuelDashboardSection from '../../components/fuel/ManualFuelDashboardSection';"
  );

  content = content.replace(
    /<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\);\s*\}\s*;\s*export default DashboardPage;/,
    "</div>\n        </div>\n      </div>\n      {/* Manual Fuel Monitoring & Mileage Prediction Section */}\n      <ManualFuelDashboardSection />\n    </div>\n  );\n};\n\nexport default DashboardPage;"
  );

  fs.writeFileSync(targetFile, content, 'utf8');
  console.log('SUCCESS: DashboardPage.jsx updated.');
} else {
  console.log('ALREADY INCLUDED.');
}
