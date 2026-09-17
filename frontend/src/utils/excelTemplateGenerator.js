import ExcelJS from 'exceljs';

// Fields the user has marked as mandatory
const MANDATORY_KEYS = new Set([
  'deviceType', 'imei', 'iccid', 'vltdSlno', 'vehicleId',
  'vehicleTypeSelect', 'vehicleVoltage', 'engineOnStatus', 'odoDistance',
  'serviceEngineer', 'serviceEngineerPhone', 'installedDate', 'onboardingDate',
  'ownerName', 'ownerPhone', 'rtoLocation', 'ownerAadhar', 'ownerPan',
  'username', 'password'
]);

export const generateVehicleOnboardingTemplate = async (availableGroups = [], orgName = '') => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FuelTracks Platform';
  workbook.lastModifiedBy = 'FuelTracks';
  workbook.created = new Date();

  // 1. Data Sheet
  const sheet = workbook.addWorksheet('Vehicle_Onboarding', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
  });

  // Columns definition — mandatory fields get * suffix in header
  const columns = [
    { header: 'Sl.No',                         key: 'slno',                 width: 10 },
    { header: 'Device Type *',                 key: 'deviceType',           width: 22 },
    { header: 'Device ID(IMEI) *',             key: 'imei',                 width: 22 },
    { header: 'ICCID *',                       key: 'iccid',                width: 24 },
    { header: 'VLTD SLNO *',                   key: 'vltdSlno',             width: 22 },
    { header: 'Vehicle ID *',                  key: 'vehicleId',            width: 22 },
    { header: 'Vehicle Name',                  key: 'vehicleName',          width: 22 },
    { header: 'Registration Number',           key: 'registrationNo',       width: 24 },
    { header: 'Vehicle Type *',                key: 'vehicleTypeSelect',    width: 20 },
    { header: 'Chassis Number',                key: 'chassisNo',            width: 24 },
    { header: 'GPS SIM Number 1',              key: 'sim1',                 width: 20 },
    { header: 'GPS SIM Number 2',              key: 'sim2',                 width: 20 },
    { header: 'Odometer *',                    key: 'odoDistance',          width: 16 },
    { header: 'Vehicle Voltage *',             key: 'vehicleVoltage',       width: 18 },
    { header: 'Ignition ON Status *',          key: 'engineOnStatus',       width: 26 },
    { header: 'Sensor Number',                 key: 'sensorNo',             width: 18 },
    { header: 'Service Engineer Name *',       key: 'serviceEngineer',      width: 28 },
    { header: 'Service Engineer Mobile *',     key: 'serviceEngineerPhone', width: 26 },
    { header: 'Salesman',                      key: 'salesman',             width: 20 },
    { header: 'Salesman Mobile Number',        key: 'salesmanPhone',        width: 24 },
    { header: 'Installation Date *',           key: 'installedDate',        width: 20 },
    { header: 'Onboarding Date *',             key: 'onboardingDate',       width: 20 },
    { header: 'Owner Name *',                  key: 'ownerName',            width: 22 },
    { header: 'Owner Mobile Number *',         key: 'ownerPhone',           width: 22 },
    { header: 'Owner Email ID',                key: 'email',                width: 26 },
    { header: 'Owner Location *',              key: 'rtoLocation',          width: 26 },
    { header: 'Owner Aadhar ID *',             key: 'ownerAadhar',          width: 22 },
    { header: 'Owner Pancard Number *',        key: 'ownerPan',             width: 24 },
    { header: 'Username *',                    key: 'username',             width: 20 },
    { header: 'Password *',                    key: 'password',             width: 20 },
    { header: 'Existing Group',                key: 'existingGroup',        width: 24 },
    { header: 'New Group (Auto-Create)',        key: 'newGroup',             width: 28 },
    { header: 'Category',                      key: 'category',             width: 20 }
  ];

  sheet.columns = columns;

  // Header Row Styling — orange = mandatory, slate = optional
  const headerRow = sheet.getRow(1);
  headerRow.height = 32;
  headerRow.eachCell((cell, colNumber) => {
    const col = columns[colNumber - 1];
    const isMandatory = col && MANDATORY_KEYS.has(col.key);
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: isMandatory ? 'FFD97706' : 'FF1E293B' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    cell.border = {
      top:    { style: 'thin',   color: { argb: isMandatory ? 'FFB45309' : 'FF334155' } },
      bottom: { style: 'medium', color: { argb: isMandatory ? 'FFFFFBEB' : 'FFF97316' } },
      left:   { style: 'thin',   color: { argb: isMandatory ? 'FFB45309' : 'FF334155' } },
      right:  { style: 'thin',   color: { argb: isMandatory ? 'FFB45309' : 'FF334155' } }
    };
  });

  // Blank Rows for User Input — mandatory cells get a light yellow tint
  for (let i = 1; i <= 50; i++) {
    const row = sheet.addRow({});
    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const col = columns[colNumber - 1];
      const isMandatory = col && MANDATORY_KEYS.has(col.key);
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = { vertical: 'middle' };
      if (isMandatory) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9EB' } };
      }
      cell.border = {
        top:    { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left:   { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right:  { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });
  }

  // 2. Reference Sheet for Dropdowns
  const refSheet = workbook.addWorksheet('Dropdown_Options');

  const deviceTypeOptions = [
    'VOLTY (5004)', 'CONCOX (5002)', 'AIS140 V2 (5003)', 'FMB 920 (5005)',
    'PT06 (5006)', 'EC08 (5007)', 'PN02 (5008)', 'V5 4G (5009)', 'BSTPL (5000)', 'AIS140 (5001)'
  ];
  const categoryOptions = ['TG Mining', 'VLTD', 'VLTD + Mining', 'General'];
  const vehicleTypeOptions = [
    'Truck', 'Car', 'Van', 'Bus', 'Scooty', 'Motorcycle',
    'Tractor', 'JCB', 'Crane', 'Ambulance', 'Pickup', 'Borewell', 'Tanker', 'Tipper'
  ];
  const engineOnOptions = ['Voltage+Ignition', 'Ignition', 'Voltage', 'Digital Input 1', 'Digital Input 2'];
  const groupOptions = availableGroups.length > 0
    ? availableGroups.map(g => g.name)
    : ['North Fleet', 'South Fleet', 'Mining Depot', 'Hyderabad Hub', 'Night Shift'];

  const optionsMap = [
    { col: 'A', title: 'Device Types',       values: deviceTypeOptions },
    { col: 'B', title: 'Categories',          values: categoryOptions },
    { col: 'C', title: 'Vehicle Types',       values: vehicleTypeOptions },
    { col: 'D', title: 'Ignition Detection',  values: engineOnOptions },
    { col: 'E', title: 'Groups',              values: groupOptions }
  ];

  optionsMap.forEach(({ col, title, values }) => {
    refSheet.getCell(`${col}1`).value = title;
    values.forEach((v, idx) => { refSheet.getCell(`${col}${idx + 2}`).value = v; });
  });
  refSheet.getRow(1).font = { bold: true };
  refSheet.columns = optionsMap.map(() => ({ width: 22 }));

  // 3. Apply Dropdowns — dynamically compute column letter from key
  const colLetter = (key) => {
    const idx = columns.findIndex(c => c.key === key);
    if (idx < 0) return null;
    let n = idx + 1, result = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      result = String.fromCharCode(65 + rem) + result;
      n = Math.floor((n - 1) / 26);
    }
    return result;
  };

  for (let rowIdx = 2; rowIdx <= 500; rowIdx++) {
    const dType = colLetter('deviceType');
    if (dType) sheet.getCell(`${dType}${rowIdx}`).dataValidation = {
      type: 'list', allowBlank: true,
      formulae: [`Dropdown_Options!$A$2:$A$${deviceTypeOptions.length + 1}`],
      showErrorMessage: true, errorTitle: 'Invalid Device Type',
      error: 'Please select a supported device type from the dropdown list.'
    };

    const vType = colLetter('vehicleTypeSelect');
    if (vType) sheet.getCell(`${vType}${rowIdx}`).dataValidation = {
      type: 'list', allowBlank: true,
      formulae: [`Dropdown_Options!$C$2:$C$${vehicleTypeOptions.length + 1}`],
      showErrorMessage: true, errorTitle: 'Invalid Vehicle Type',
      error: 'Please select a vehicle type from the dropdown list.'
    };

    const ign = colLetter('engineOnStatus');
    if (ign) sheet.getCell(`${ign}${rowIdx}`).dataValidation = {
      type: 'list', allowBlank: true,
      formulae: [`Dropdown_Options!$D$2:$D$${engineOnOptions.length + 1}`],
      showErrorMessage: true, errorTitle: 'Invalid Ignition ON Status',
      error: 'Please select an ignition status from the dropdown list.'
    };

    const grp = colLetter('existingGroup');
    if (grp) sheet.getCell(`${grp}${rowIdx}`).dataValidation = {
      type: 'list', allowBlank: true,
      formulae: [`Dropdown_Options!$E$2:$E$${groupOptions.length + 1}`],
      showErrorMessage: true, errorTitle: 'Invalid Group',
      error: 'Please select an existing group from the dropdown list.'
    };

    const cat = colLetter('category');
    if (cat) sheet.getCell(`${cat}${rowIdx}`).dataValidation = {
      type: 'list', allowBlank: true,
      formulae: [`Dropdown_Options!$B$2:$B$${categoryOptions.length + 1}`],
      showErrorMessage: true, errorTitle: 'Invalid Category',
      error: 'Please select a category from the dropdown list.'
    };
  }

  // 4. Instructions Sheet
  const infoSheet = workbook.addWorksheet('Instructions');
  infoSheet.columns = [
    { header: 'Column Name',                key: 'colName',     width: 32 },
    { header: 'Dropdown Available',          key: 'hasDropdown', width: 22 },
    { header: 'Mandatory',                   key: 'req',         width: 14 },
    { header: 'Description / Instructions',  key: 'desc',        width: 75 }
  ];
  const infoHeader = infoSheet.getRow(1);
  infoHeader.height = 24;
  infoHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  infoHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

  const guidelines = [
    { colName: 'Sl.No',                      hasDropdown: 'NO',             req: 'NO',  desc: 'Sequential index number.' },
    { colName: 'Device Type *',              hasDropdown: 'YES (Dropdown)', req: 'YES', desc: 'Select device protocol with port number e.g. VOLTY (5004). Orange = mandatory.' },
    { colName: 'Device ID(IMEI) *',          hasDropdown: 'NO',             req: 'YES', desc: '15-digit unique GPS device IMEI number.' },
    { colName: 'ICCID *',                    hasDropdown: 'NO',             req: 'YES', desc: 'SIM card ICCID number (19-20 digits).' },
    { colName: 'VLTD SLNO *',               hasDropdown: 'NO',             req: 'YES', desc: 'Compliance serial number for VLTD certification.' },
    { colName: 'Vehicle ID *',               hasDropdown: 'NO',             req: 'YES', desc: 'System unique vehicle ID / tracker map key.' },
    { colName: 'Vehicle Name',               hasDropdown: 'NO',             req: 'NO',  desc: 'Display name of vehicle (e.g. Tipper TS09).' },
    { colName: 'Registration Number',         hasDropdown: 'NO',             req: 'NO',  desc: 'Official license plate number.' },
    { colName: 'Vehicle Type *',             hasDropdown: 'YES (Dropdown)', req: 'YES', desc: 'Truck, Car, Van, Bus, Scooty, Motorcycle, etc.' },
    { colName: 'Chassis Number',             hasDropdown: 'NO',             req: 'NO',  desc: 'Vehicle chassis serial number.' },
    { colName: 'GPS SIM Number 1 & 2',       hasDropdown: 'NO',             req: 'NO',  desc: 'Primary and secondary SIM phone numbers.' },
    { colName: 'Odometer *',                 hasDropdown: 'NO',             req: 'YES', desc: 'Current starting odometer reading (km).' },
    { colName: 'Vehicle Voltage *',          hasDropdown: 'NO',             req: 'YES', desc: 'Battery voltage rating entered manually e.g. 12V.' },
    { colName: 'Ignition ON Status *',       hasDropdown: 'YES (Dropdown)', req: 'YES', desc: 'Detection config: Voltage+Ignition, Ignition, Voltage, Digital Input 1/2.' },
    { colName: 'Sensor Number',              hasDropdown: 'NO',             req: 'NO',  desc: 'Optional fuel or temperature sensor ID.' },
    { colName: 'Service Engineer Name *',    hasDropdown: 'NO',             req: 'YES', desc: 'Full name of installation technician.' },
    { colName: 'Service Engineer Mobile *',  hasDropdown: 'NO',             req: 'YES', desc: 'Service engineer phone number.' },
    { colName: 'Salesman',                   hasDropdown: 'NO',             req: 'NO',  desc: 'Sales representative name.' },
    { colName: 'Salesman Mobile Number',     hasDropdown: 'NO',             req: 'NO',  desc: 'Sales representative phone number.' },
    { colName: 'Installation Date *',        hasDropdown: 'NO',             req: 'YES', desc: 'Date of device installation (YYYY-MM-DD).' },
    { colName: 'Onboarding Date *',          hasDropdown: 'NO',             req: 'YES', desc: 'Date of system onboarding (YYYY-MM-DD).' },
    { colName: 'Owner Name *',               hasDropdown: 'NO',             req: 'YES', desc: 'Full name of vehicle owner.' },
    { colName: 'Owner Mobile Number *',      hasDropdown: 'NO',             req: 'YES', desc: 'Owner mobile number.' },
    { colName: 'Owner Email ID',             hasDropdown: 'NO',             req: 'NO',  desc: 'Owner email address.' },
    { colName: 'Owner Location *',           hasDropdown: 'NO',             req: 'YES', desc: 'Operational location / RTO circle.' },
    { colName: 'Owner Aadhar ID *',          hasDropdown: 'NO',             req: 'YES', desc: '12-digit owner Aadhar card number.' },
    { colName: 'Owner Pancard Number *',     hasDropdown: 'NO',             req: 'YES', desc: '10-character PAN card number.' },
    { colName: 'Username *',                 hasDropdown: 'NO',             req: 'YES', desc: 'Customer account login username.' },
    { colName: 'Password *',                 hasDropdown: 'NO',             req: 'YES', desc: 'Customer account login password.' },
    { colName: 'Existing Group',             hasDropdown: 'YES (Dropdown)', req: 'NO',  desc: 'Select an already existing group.' },
    { colName: 'New Group (Auto-Create)',     hasDropdown: 'NO',             req: 'NO',  desc: 'Type names of new groups to auto-create (comma-separated).' },
    { colName: 'Category',                   hasDropdown: 'YES (Dropdown)', req: 'NO',  desc: 'TG Mining, VLTD, VLTD + Mining, General.' }
  ];

  guidelines.forEach(g => {
    const row = infoSheet.addRow(g);
    if (g.req === 'YES') {
      row.getCell('req').font   = { bold: true, color: { argb: 'FFB45309' } };
      row.getCell('colName').font = { bold: true };
    }
  });

  infoSheet.addRow({});
  const legendRow = infoSheet.addRow({
    colName: '★ Orange header columns are MANDATORY — must be filled for every vehicle row.'
  });
  legendRow.getCell('colName').font = { bold: true, color: { argb: 'FFD97706' }, italic: true };

  // 5. Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileName = orgName
    ? `FuelTracks_Onboarding_Template_${orgName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`
    : 'FuelTracks_Vehicle_Onboarding_Template.xlsx';
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};
