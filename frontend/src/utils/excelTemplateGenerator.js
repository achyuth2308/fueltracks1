import ExcelJS from 'exceljs';

export const generateVehicleOnboardingTemplate = async (availableGroups = [], orgName = '') => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FuelTracks Platform';
  workbook.lastModifiedBy = 'FuelTracks';
  workbook.created = new Date();

  // 1. Data Sheet
  const sheet = workbook.addWorksheet('Vehicle_Onboarding', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
  });

  // Columns definition matching user's exact specification and order
  sheet.columns = [
    { header: 'Sl.No', key: 'slno', width: 10 },
    { header: 'LicenceId', key: 'licenceId', width: 20 },
    { header: 'Device Type', key: 'deviceType', width: 22 },
    { header: 'Device ID(IMEI)', key: 'imei', width: 22 },
    { header: 'ICCID', key: 'iccid', width: 24 },
    { header: 'VLTD SLNO', key: 'vltdSlno', width: 22 },
    { header: 'Vehicle Id', key: 'vehicleId', width: 22 },
    { header: 'Vehicle Name', key: 'vehicleName', width: 22 },
    { header: 'Registration Number', key: 'registrationNo', width: 24 },
    { header: 'Vehicle Type', key: 'vehicleTypeSelect', width: 20 },
    { header: 'Chassis Number', key: 'chassisNo', width: 24 },
    { header: 'GPS SIM Number 1', key: 'sim1', width: 20 },
    { header: 'GPS SIM Number 2', key: 'sim2', width: 20 },
    { header: 'Odometer', key: 'odoDistance', width: 16 },
    { header: 'Vehicle Voltage', key: 'vehicleVoltage', width: 18 },
    { header: 'Ignition ON Status', key: 'engineOnStatus', width: 26 },
    { header: 'Sensor Number', key: 'sensorNo', width: 18 },
    { header: 'Service Engineer Number', key: 'serviceEngineer', width: 26 },
    { header: 'Service Mobile Number', key: 'serviceEngineerPhone', width: 24 },
    { header: 'Salesman', key: 'salesman', width: 20 },
    { header: 'Salesman Mobile Number', key: 'salesmanPhone', width: 24 },
    { header: 'Installation Date', key: 'installedDate', width: 18 },
    { header: 'Onboarding Date', key: 'onboardingDate', width: 18 },
    { header: 'Owner Name', key: 'ownerName', width: 22 },
    { header: 'Owner Mobile Number', key: 'ownerPhone', width: 22 },
    { header: 'Owner Email ID', key: 'email', width: 26 },
    { header: 'Owner Location', key: 'rtoLocation', width: 26 },
    { header: 'Owner Aadhar ID', key: 'ownerAadhar', width: 20 },
    { header: 'Owner Pancard Number', key: 'ownerPan', width: 22 },
    { header: 'Username', key: 'username', width: 20 },
    { header: 'Password', key: 'password', width: 20 },
    { header: 'Group', key: 'group', width: 24 },
    { header: 'Category', key: 'category', width: 20 }
  ];

  // Header Row Styling
  const headerRow = sheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Slate 800
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'medium', color: { argb: 'FFF97316' } }, // Orange bottom border
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } }
    };
  });

  // Blank Rows for User Input (Pre-formatted styling)
  for (let i = 1; i <= 50; i++) {
    const row = sheet.addRow({});
    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = { vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });
  }

  // 2. Reference Sheet for Dropdowns
  const refSheet = workbook.addWorksheet('Dropdown_Options');
  
  // Device types with port numbers as requested by user
  const deviceTypeOptions = [
    'VOLTY (5004)',
    'AS140 (5001)',
    'CONCOX (5002)',
    'AIS140 V2 (5003)',
    'FMB 920 (5005)',
    'BSTPL (5000)',
    'AIS140 (5001)'
  ];
  const categoryOptions = ['TG Mining', 'VLTD', 'VLTD + Mining', 'General'];
  const vehicleTypeOptions = [
    'Truck',
    'Car',
    'Van',
    'Bus',
    'Scooty',
    'Motorcycle',
    'Tractor',
    'JCB',
    'Crane',
    'Ambulance',
    'Pickup',
    'Borewell',
    'Tanker',
    'Tipper'
  ];
  const engineOnOptions = ['Voltage+Ignition', 'Ignition', 'Voltage', 'Digital Input 1', 'Digital Input 2'];
  const groupOptions = availableGroups.length > 0
    ? availableGroups.map(g => g.name)
    : ['North Fleet', 'South Fleet', 'Mining Depot', 'Hyderabad Hub', 'Night Shift'];

  // Populate reference lists
  const optionsMap = [
    { col: 'A', title: 'Device Types', values: deviceTypeOptions },
    { col: 'B', title: 'Categories', values: categoryOptions },
    { col: 'C', title: 'Vehicle Types', values: vehicleTypeOptions },
    { col: 'D', title: 'Ignition Detection', values: engineOnOptions },
    { col: 'E', title: 'Groups', values: groupOptions }
  ];

  optionsMap.forEach(({ col, title, values }) => {
    refSheet.getCell(`${col}1`).value = title;
    values.forEach((v, idx) => {
      refSheet.getCell(`${col}${idx + 2}`).value = v;
    });
  });

  refSheet.getRow(1).font = { bold: true };
  refSheet.columns = optionsMap.map(() => ({ width: 22 }));

  // 3. Apply Native Excel Data Validations (Dropdowns) across rows 2 to 500
  for (let rowIdx = 2; rowIdx <= 500; rowIdx++) {
    // Column C: Device Type Dropdown
    sheet.getCell(`C${rowIdx}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Dropdown_Options!$A$2:$A$${deviceTypeOptions.length + 1}`],
      showErrorMessage: true,
      errorTitle: 'Invalid Device Type',
      error: 'Please select a supported device type from the dropdown list.'
    };

    // Column J: Vehicle Type Dropdown
    sheet.getCell(`J${rowIdx}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Dropdown_Options!$C$2:$C$${vehicleTypeOptions.length + 1}`],
      showErrorMessage: true,
      errorTitle: 'Invalid Vehicle Type',
      error: 'Please select a vehicle type from the dropdown list.'
    };

    // Column P: Ignition ON Status Dropdown
    sheet.getCell(`P${rowIdx}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Dropdown_Options!$D$2:$D$${engineOnOptions.length + 1}`],
      showErrorMessage: true,
      errorTitle: 'Invalid Ignition ON Status',
      error: 'Please select an ignition status from the dropdown list.'
    };

    // Column AF: Group Dropdown
    sheet.getCell(`AF${rowIdx}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Dropdown_Options!$E$2:$E$${groupOptions.length + 1}`],
      showErrorMessage: false,
      promptTitle: 'Assigned Group',
      prompt: 'Select a group from the list, or enter multiple groups separated by commas.'
    };

    // Column AG: Category Dropdown
    sheet.getCell(`AG${rowIdx}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Dropdown_Options!$B$2:$B$${categoryOptions.length + 1}`],
      showErrorMessage: true,
      errorTitle: 'Invalid Category',
      error: 'Please select a category from the dropdown list.'
    };
  }

  // 4. Instructions Sheet
  const infoSheet = workbook.addWorksheet('Instructions');
  infoSheet.columns = [
    { header: 'Column Name', key: 'colName', width: 30 },
    { header: 'Dropdown Available', key: 'hasDropdown', width: 22 },
    { header: 'Mandatory', key: 'req', width: 14 },
    { header: 'Description / Instructions', key: 'desc', width: 75 }
  ];

  const infoHeader = infoSheet.getRow(1);
  infoHeader.height = 24;
  infoHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  infoHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

  const guidelines = [
    { colName: 'Sl.No', hasDropdown: 'NO', req: 'NO', desc: 'Sequential index number.' },
    { colName: 'LicenceId', hasDropdown: 'NO', req: 'NO', desc: 'Optional license verification token.' },
    { colName: 'Device Type', hasDropdown: 'YES (Dropdown)', req: 'YES', desc: 'Select device protocol with port number (e.g. VOLTY (5004)).' },
    { colName: 'Device ID(IMEI)', hasDropdown: 'NO', req: 'YES', desc: '15-digit unique GPS device IMEI number.' },
    { colName: 'ICCID', hasDropdown: 'NO', req: 'NO', desc: 'SIM card ICCID number (19-20 digits).' },
    { colName: 'VLTD SLNO', hasDropdown: 'NO', req: 'NO', desc: 'Compliance serial number.' },
    { colName: 'Vehicle Id', hasDropdown: 'NO', req: 'YES', desc: 'System unique vehicle ID / tracker map key.' },
    { colName: 'Vehicle Name', hasDropdown: 'NO', req: 'NO', desc: 'Display name of vehicle (e.g. Tipper TS09).' },
    { colName: 'Registration Number', hasDropdown: 'NO', req: 'YES', desc: 'Official license plate number.' },
    { colName: 'Vehicle Type', hasDropdown: 'YES (Dropdown)', req: 'NO', desc: 'Truck, Car, Van, Bus, Scooty, Motorcycle, etc.' },
    { colName: 'Chassis Number', hasDropdown: 'NO', req: 'NO', desc: 'Vehicle chassis serial number.' },
    { colName: 'GPS SIM Number 1 & 2', hasDropdown: 'NO', req: 'NO', desc: 'Primary and secondary SIM phone numbers.' },
    { colName: 'Odometer', hasDropdown: 'NO', req: 'NO', desc: 'Current starting odometer reading (km).' },
    { colName: 'Vehicle Voltage', hasDropdown: 'NO', req: 'NO', desc: 'Battery voltage rating entered manually.' },
    { colName: 'Ignition ON Status', hasDropdown: 'YES (Dropdown)', req: 'NO', desc: 'Ignition status detection configuration.' },
    { colName: 'Sensor Number', hasDropdown: 'NO', req: 'NO', desc: 'Optional fuel / temp sensor ID.' },
    { colName: 'Service Engineer Number', hasDropdown: 'NO', req: 'NO', desc: 'Name of installation technician.' },
    { colName: 'Service Mobile Number', hasDropdown: 'NO', req: 'NO', desc: 'Service engineer phone number.' },
    { colName: 'Salesman', hasDropdown: 'NO', req: 'NO', desc: 'Sales representative name.' },
    { colName: 'Salesman Mobile Number', hasDropdown: 'NO', req: 'NO', desc: 'Sales representative phone number.' },
    { colName: 'Installation Date', hasDropdown: 'NO', req: 'NO', desc: 'Date of device installation (YYYY-MM-DD).' },
    { colName: 'Onboarding Date', hasDropdown: 'NO', req: 'NO', desc: 'Date of system onboarding (YYYY-MM-DD).' },
    { colName: 'Owner Name', hasDropdown: 'NO', req: 'NO', desc: 'Full name of vehicle owner.' },
    { colName: 'Owner Mobile Number', hasDropdown: 'NO', req: 'NO', desc: 'Owner mobile number.' },
    { colName: 'Owner Email ID', hasDropdown: 'NO', req: 'NO', desc: 'Owner email address.' },
    { colName: 'Owner Location', hasDropdown: 'NO', req: 'NO', desc: 'Operational location / RTO circle.' },
    { colName: 'Owner Aadhar ID', hasDropdown: 'NO', req: 'NO', desc: '12-digit owner Aadhar ID.' },
    { colName: 'Owner Pancard Number', hasDropdown: 'NO', req: 'NO', desc: '10-character PAN number.' },
    { colName: 'Username', hasDropdown: 'NO', req: 'NO', desc: 'Customer account login username.' },
    { colName: 'Password', hasDropdown: 'NO', req: 'NO', desc: 'Customer account login password.' },
    { colName: 'Group', hasDropdown: 'YES (Dropdown)', req: 'NO', desc: 'Assigned monitoring groups (comma-separated).' },
    { colName: 'Category', hasDropdown: 'YES (Dropdown)', req: 'YES', desc: 'TG Mining, VLTD, VLTD + Mining, General.' }
  ];

  guidelines.forEach(g => {
    infoSheet.addRow(g);
  });

  // 5. Generate and download buffer
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
