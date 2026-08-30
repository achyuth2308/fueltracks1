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

  // Columns definition matching simplified specifications
  sheet.columns = [
    // Business Information
    { header: 'Customer Name', key: 'customerName', width: 22 },
    { header: 'Customer Mobile Number', key: 'customerPhone', width: 22 },
    { header: 'Customer Location', key: 'rtoLocation', width: 26 },
    { header: 'Customer Aadhar', key: 'ownerAadhar', width: 20 },
    { header: 'Customer PAN', key: 'ownerPan', width: 18 },
    { header: 'Customer Email ID', key: 'email', width: 26 },
    { header: 'Username Name', key: 'username', width: 20 },
    { header: 'Password', key: 'password', width: 20 },

    // Device & Compliance
    { header: 'LicenceId', key: 'licenceId', width: 20 },
    { header: 'Device Type', key: 'deviceType', width: 18 },
    { header: 'Device ID(IMEI)', key: 'imei', width: 22 },
    { header: 'VLTD SLNO', key: 'vltdSlno', width: 22 },
    { header: 'ICCID', key: 'iccid', width: 24 },
    { header: 'GPS SIMNO 1', key: 'sim1', width: 18 },
    { header: 'GPS SIMNO 2', key: 'sim2', width: 18 },
    { header: 'Sensor No', key: 'sensorNo', width: 18 },

    // Vehicle Configurations
    { header: 'Vehicle Id', key: 'vehicleId', width: 22 },
    { header: 'Vehicle Name', key: 'vehicleName', width: 22 },
    { header: 'Registration No', key: 'registrationNo', width: 20 },
    { header: 'Vehicle Type', key: 'vehicleTypeSelect', width: 20 },
    { header: 'Vehicle Model', key: 'vehicleModel', width: 20 },
    { header: 'Chassis Number', key: 'chassisNo', width: 24 },
    { header: 'Engine Number', key: 'engineNo', width: 20 },
    { header: 'Odo Distance', key: 'odoDistance', width: 16 },
    { header: 'Vehicle Voltage', key: 'vehicleVoltage', width: 18 },
    { header: 'Timezone', key: 'timezone', width: 16 },
    { header: 'Ignition Detection', key: 'engineOnStatus', width: 26 },

    // Installation & Logistics
    { header: 'Service Engineer', key: 'serviceEngineer', width: 22 },
    { header: 'Service Engineer Mobno', key: 'serviceEngineerPhone', width: 28 },
    { header: 'Salesman', key: 'salesman', width: 20 },
    { header: 'Salesman Mobno', key: 'salesmanPhone', width: 24 },
    { header: 'Ticket Id', key: 'ticketId', width: 18 },
    { header: 'Installed Date', key: 'installedDate', width: 18 },
    { header: 'GROUP', key: 'group', width: 24 },
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

  // Sample Rows
  const sampleGroup = availableGroups[0]?.name || 'Mining Depot';

  const row1 = sheet.addRow({
    customerName: 'Ramesh Reddy',
    customerPhone: '9833344455',
    rtoLocation: 'Hyderabad RTO',
    ownerAadhar: '123456789012',
    ownerPan: 'ABCDE1234F',
    email: 'ramesh.reddy@example.com',
    username: 'ramesh_reddy',
    password: 'Password@123',

    licenceId: 'ST6A1FE9FC0E066',
    deviceType: 'AIS140',
    imei: '865006049210215',
    vltdSlno: 'VLT-TS-98721',
    iccid: '8991860000000000000',
    sim1: '9876543210',
    sim2: '9876543211',
    sensorNo: 'SNS-FUEL-01',

    vehicleId: 'TS09AB1234',
    vehicleName: 'Tipper TS09',
    registrationNo: 'TS09AB1234',
    vehicleTypeSelect: 'Tipper',
    vehicleModel: 'Tata Prima',
    chassisNo: 'MAT426012ABC12345',
    engineNo: 'ENG987654321',
    odoDistance: '150',
    vehicleVoltage: '24V',
    timezone: 'IST',
    engineOnStatus: 'Voltage+Ignition',

    serviceEngineer: 'Vikram Patel',
    serviceEngineerPhone: '9822233344',
    salesman: 'Rahul Sharma',
    salesmanPhone: '9811122233',
    ticketId: 'TCK-98721',
    installedDate: '2026-08-29',
    group: sampleGroup,
    category: 'TG Mining'
  });

  const row2 = sheet.addRow({
    customerName: 'Suresh Kumar',
    customerPhone: '9844455566',
    rtoLocation: 'Secunderabad',
    ownerAadhar: '234567890123',
    ownerPan: 'BCDEF2345G',
    email: 'suresh.k@example.com',
    username: 'suresh_kumar',
    password: 'Password@123',

    licenceId: 'ST6A1FE9FC0E067',
    deviceType: 'BSTPL',
    imei: '865006049210216',
    vltdSlno: 'VLT-TS-98722',
    iccid: '8991860000000000001',
    sim1: '9876543220',
    sim2: '',
    sensorNo: 'SNS-TEMP-02',

    vehicleId: 'TS07CD5678',
    vehicleName: 'Bus TS07',
    registrationNo: 'TS07CD5678',
    vehicleTypeSelect: 'Bus',
    vehicleModel: 'Eicher Starline',
    chassisNo: 'MAT426012ABC12346',
    engineNo: 'ENG987654322',
    odoDistance: '0',
    vehicleVoltage: '12V',
    timezone: 'IST',
    engineOnStatus: 'Ignition',

    serviceEngineer: 'Vikram Patel',
    serviceEngineerPhone: '9822233344',
    salesman: 'Rahul Sharma',
    salesmanPhone: '9811122233',
    ticketId: 'TCK-98722',
    installedDate: '2026-08-29',
    group: sampleGroup,
    category: 'VLTD'
  });

  [row1, row2].forEach(r => {
    r.height = 22;
    r.eachCell(cell => {
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = { vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });
  });

  // 2. Reference Sheet for Dropdowns
  const refSheet = workbook.addWorksheet('Dropdown_Options');
  
  const deviceTypeOptions = ['AIS140', 'BSTPL', 'CONCOX', 'FMB920', 'VOLTY', 'AIS140 V2', 'GT06N'];
  const categoryOptions = ['TG Mining', 'VLTD', 'VLTD + Mining', 'General'];
  const vehicleTypeOptions = ['Truck', 'Tipper', 'Tanker', 'Bus', 'Car', 'Van', 'Tractor', 'JCB', 'Crane', 'Ambulance', 'Pickup', 'Borewell', 'Trailer', 'Auto / 3-Wheeler'];
  const engineOnOptions = ['Voltage+Ignition', 'Ignition', 'Voltage', 'Digital Input 1', 'Digital Input 2'];
  const timezoneOptions = ['IST', 'UTC', 'Asia/Kolkata'];
  const groupOptions = availableGroups.length > 0
    ? availableGroups.map(g => g.name)
    : ['North Fleet', 'South Fleet', 'Mining Depot', 'Hyderabad Hub', 'Night Shift'];

  // Populate reference lists
  const optionsMap = [
    { col: 'A', title: 'Device Types', values: deviceTypeOptions },
    { col: 'B', title: 'Categories', values: categoryOptions },
    { col: 'C', title: 'Vehicle Types', values: vehicleTypeOptions },
    { col: 'D', title: 'Ignition Detection', values: engineOnOptions },
    { col: 'E', title: 'Timezones', values: timezoneOptions },
    { col: 'F', title: 'Groups', values: groupOptions }
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
    // Column J: Device Type Dropdown
    sheet.getCell(`J${rowIdx}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Dropdown_Options!$A$2:$A$${deviceTypeOptions.length + 1}`],
      showErrorMessage: true,
      errorTitle: 'Invalid Device Type',
      error: 'Please select a supported device protocol from the dropdown list.'
    };

    // Column AI: Category Dropdown
    sheet.getCell(`AI${rowIdx}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Dropdown_Options!$B$2:$B$${categoryOptions.length + 1}`],
      showErrorMessage: true,
      errorTitle: 'Invalid Category',
      error: 'Please select a category from the dropdown list.'
    };

    // Column T: Vehicle Type Dropdown
    sheet.getCell(`T${rowIdx}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Dropdown_Options!$C$2:$C$${vehicleTypeOptions.length + 1}`],
      showErrorMessage: true,
      errorTitle: 'Invalid Vehicle Type',
      error: 'Please select a vehicle type from the dropdown list.'
    };

    // Column AA: Ignition Detection Dropdown
    sheet.getCell(`AA${rowIdx}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Dropdown_Options!$D$2:$D$${engineOnOptions.length + 1}`],
      showErrorMessage: true,
      errorTitle: 'Invalid Ignition Detection',
      error: 'Please select an ignition detection status from the dropdown list.'
    };

    // Column Z: Timezone Dropdown
    sheet.getCell(`Z${rowIdx}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Dropdown_Options!$E$2:$E$${timezoneOptions.length + 1}`],
      showErrorMessage: false
    };

    // Column AH: GROUP Dropdown
    sheet.getCell(`AH${rowIdx}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Dropdown_Options!$F$2:$F$${groupOptions.length + 1}`],
      showErrorMessage: false,
      promptTitle: 'Assigned Group',
      prompt: 'Select a group from the list, or enter multiple groups separated by commas.'
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
    { colName: 'Customer Name', hasDropdown: 'NO', req: 'NO', desc: 'Customer account full name.' },
    { colName: 'Customer Mobile Number', hasDropdown: 'NO', req: 'NO', desc: 'Customer 10-digit mobile contact number.' },
    { colName: 'Customer Location', hasDropdown: 'NO', req: 'NO', desc: 'Operational location / RTO circle of customer.' },
    { colName: 'Customer Aadhar', hasDropdown: 'NO', req: 'NO', desc: '12-digit customer Aadhar number.' },
    { colName: 'Customer PAN', hasDropdown: 'NO', req: 'NO', desc: '10-character customer PAN card number.' },
    { colName: 'Customer Email ID', hasDropdown: 'NO', req: 'NO', desc: 'Unique customer email address. Used for notifications.' },
    { colName: 'Username Name', hasDropdown: 'NO', req: 'NO', desc: 'Web portal login username.' },
    { colName: 'Password', hasDropdown: 'NO', req: 'NO', desc: 'Web portal login password.' },

    { colName: 'LicenceId', hasDropdown: 'NO', req: 'NO', desc: 'Optional license verification token (e.g. basic, advanced, premium).' },
    { colName: 'Device Type', hasDropdown: 'YES (Dropdown)', req: 'YES', desc: 'VOLTY, AIS140, BSTPL, CONCOX, FMB920, AIS140 V2, GT06N.' },
    { colName: 'Device ID(IMEI)', hasDropdown: 'NO', req: 'YES', desc: '15-digit unique GPS device IMEI number.' },
    { colName: 'VLTD SLNO', hasDropdown: 'NO', req: 'NO', desc: 'VLT compliance serial number.' },
    { colName: 'ICCID', hasDropdown: 'NO', req: 'NO', desc: 'SIM card ICCID number (19-20 digits).' },
    { colName: 'GPS SIMNO 1 & 2', hasDropdown: 'NO', req: 'NO', desc: 'Primary and secondary SIM phone numbers.' },
    { colName: 'Sensor No', hasDropdown: 'NO', req: 'NO', desc: 'Optional temperature / fuel sensor ID.' },

    { colName: 'Vehicle Id', hasDropdown: 'NO', req: 'YES', desc: 'System unique vehicle ID / tracker map key.' },
    { colName: 'Vehicle Name', hasDropdown: 'NO', req: 'NO', desc: 'Display name of vehicle (e.g. Tipper TS09).' },
    { colName: 'Registration No', hasDropdown: 'NO', req: 'YES', desc: 'Official RTO license plate number.' },
    { colName: 'Vehicle Type', hasDropdown: 'YES (Dropdown)', req: 'NO', desc: 'Truck, Tipper, Tanker, Bus, Car, Tractor, JCB, Crane, etc.' },
    { colName: 'Vehicle Model', hasDropdown: 'NO', req: 'NO', desc: 'Make and model (e.g. Tata Prima).' },
    { colName: 'Chassis Number', hasDropdown: 'NO', req: 'NO', desc: 'Vehicle chassis/VIN number.' },
    { colName: 'Engine Number', hasDropdown: 'NO', req: 'NO', desc: 'Vehicle engine serial number.' },
    { colName: 'Odo Distance', hasDropdown: 'NO', req: 'NO', desc: 'Current starting odometer reading offset (km).' },
    { colName: 'Vehicle Voltage', hasDropdown: 'NO', req: 'NO', desc: 'Battery voltage rating (12V or 24V).' },
    { colName: 'Timezone', hasDropdown: 'YES (Dropdown)', req: 'NO', desc: 'IST, UTC, or Asia/Kolkata (Default IST).' },
    { colName: 'Ignition Detection', hasDropdown: 'YES (Dropdown)', req: 'NO', desc: 'Voltage+Ignition, Ignition, Voltage, Digital Input 1.' },

    { colName: 'Service Engineer', hasDropdown: 'NO', req: 'NO', desc: 'Name of technician who installed the device.' },
    { colName: 'Service Engineer Mobno', hasDropdown: 'NO', req: 'NO', desc: 'Mobile number of the service engineer.' },
    { colName: 'Salesman', hasDropdown: 'NO', req: 'NO', desc: 'Name of sales executive.' },
    { colName: 'Salesman Mobno', hasDropdown: 'NO', req: 'NO', desc: 'Mobile number of the salesman.' },
    { colName: 'Ticket Id', hasDropdown: 'NO', req: 'NO', desc: 'Assigned installation support ticket ID.' },
    { colName: 'Installed Date', hasDropdown: 'NO', req: 'NO', desc: 'Installation date (YYYY-MM-DD).' },
    { colName: 'GROUP', hasDropdown: 'YES (Dropdown)', req: 'NO', desc: 'Assigned monitoring groups (comma-separated).' },
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
