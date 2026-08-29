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
    { header: 'Device Type', key: 'deviceType', width: 18 },
    { header: 'Device ID(IMEI)', key: 'imei', width: 22 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Vehicle Id', key: 'vehicleId', width: 22 },
    { header: 'Vehicle Model', key: 'vehicleModel', width: 20 },
    { header: 'VLTTD SLNO', key: 'vlttdSlno', width: 22 },
    { header: 'ICCID', key: 'iccid', width: 24 },
    { header: 'GPS SIMNO1', key: 'sim1', width: 18 },
    { header: 'GPS SIMNO2', key: 'sim2', width: 18 },
    { header: 'Chassis Number', key: 'chassisNo', width: 24 },
    { header: 'Engine Number', key: 'engineNo', width: 20 },
    { header: 'Sensor No', key: 'sensorNo', width: 18 },
    { header: 'engine on status', key: 'engineOnStatus', width: 22 },
    { header: 'vehicle voltage', key: 'vehicleVoltage', width: 18 },
    { header: 'timezone', key: 'timezone', width: 16 },
    { header: 'service engineer', key: 'serviceEngineer', width: 22 },
    { header: 'service engineer mobile number', key: 'serviceEngineerPhone', width: 28 },
    { header: 'Salesman', key: 'salesman', width: 20 },
    { header: 'salesman mobile number', key: 'salesmanPhone', width: 24 },
    { header: 'GROUP', key: 'group', width: 24 },
    { header: 'Owner name', key: 'ownerName', width: 22 },
    { header: 'Owner mobile number', key: 'ownerPhone', width: 22 },
    { header: 'Owner AADHAR', key: 'ownerAadhar', width: 20 },
    { header: 'Owner PAN', key: 'ownerPan', width: 18 },
    { header: 'OWNER /RTO LOCATION', key: 'rtoLocation', width: 26 },
    { header: 'Installed Date', key: 'installedDate', width: 18 },
    { header: 'Username', key: 'username', width: 20 },
    { header: 'password', key: 'password', width: 20 },
    { header: 'Email', key: 'email', width: 26 }
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
    deviceType: 'AIS140',
    imei: '865006049210215',
    category: 'TG Mining',
    vehicleId: 'TS09AB1234',
    vehicleModel: 'Tipper',
    vlttdSlno: 'VLT-TS-98721',
    iccid: '8991860000000000000',
    sim1: '9876543210',
    sim2: '9876543211',
    chassisNo: 'MAT426012ABC12345',
    engineNo: 'ENG987654321',
    sensorNo: 'SNS-FUEL-01',
    engineOnStatus: 'Voltage+Ignition',
    vehicleVoltage: '24V',
    timezone: 'IST',
    serviceEngineer: 'Vikram Patel',
    serviceEngineerPhone: '9822233344',
    salesman: 'Rahul Sharma',
    salesmanPhone: '9811122233',
    group: sampleGroup,
    ownerName: 'Ramesh Reddy',
    ownerPhone: '9833344455',
    ownerAadhar: '123456789012',
    ownerPan: 'ABCDE1234F',
    rtoLocation: 'Hyderabad RTO',
    installedDate: '2026-08-29',
    username: 'ramesh_reddy',
    password: 'Password@123',
    email: 'ramesh.reddy@example.com'
  });

  const row2 = sheet.addRow({
    deviceType: 'BSTPL',
    imei: '865006049210216',
    category: 'VLTD',
    vehicleId: 'TS07CD5678',
    vehicleModel: 'Bus',
    vlttdSlno: 'VLT-TS-98722',
    iccid: '8991860000000000001',
    sim1: '9876543220',
    sim2: '',
    chassisNo: 'MAT426012ABC12346',
    engineNo: 'ENG987654322',
    sensorNo: 'SNS-TEMP-02',
    engineOnStatus: 'Ignition',
    vehicleVoltage: '12V',
    timezone: 'IST',
    serviceEngineer: 'Vikram Patel',
    serviceEngineerPhone: '9822233344',
    salesman: 'Rahul Sharma',
    salesmanPhone: '9811122233',
    group: sampleGroup,
    ownerName: 'Suresh Kumar',
    ownerPhone: '9844455566',
    ownerAadhar: '234567890123',
    ownerPan: 'BCDEF2345G',
    rtoLocation: 'Secunderabad',
    installedDate: '2026-08-29',
    username: 'suresh_kumar',
    password: 'Password@123',
    email: 'suresh.k@example.com'
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
  const vehicleModelOptions = ['Truck', 'Tipper', 'Tanker', 'Bus', 'Car', 'Van', 'Tractor', 'JCB', 'Crane', 'Ambulance', 'Pickup', 'Borewell', 'Trailer', 'Auto / 3-Wheeler'];
  const engineOnOptions = ['Voltage+Ignition', 'Ignition', 'Voltage', 'Digital Input 1', 'Digital Input 2'];
  const timezoneOptions = ['IST', 'UTC', 'Asia/Kolkata'];
  const groupOptions = availableGroups.length > 0
    ? availableGroups.map(g => g.name)
    : ['North Fleet', 'South Fleet', 'Mining Depot', 'Hyderabad Hub', 'Night Shift'];

  // Populate reference lists
  const optionsMap = [
    { col: 'A', title: 'Device Types', values: deviceTypeOptions },
    { col: 'B', title: 'Categories', values: categoryOptions },
    { col: 'C', title: 'Vehicle Models', values: vehicleModelOptions },
    { col: 'D', title: 'Engine ON Status', values: engineOnOptions },
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
    // Column A: Device Type Dropdown
    sheet.getCell(`A${rowIdx}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Dropdown_Options!$A$2:$A$${deviceTypeOptions.length + 1}`],
      showErrorMessage: true,
      errorTitle: 'Invalid Device Type',
      error: 'Please select a supported device protocol from the dropdown list.'
    };

    // Column C: Category Dropdown
    sheet.getCell(`C${rowIdx}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Dropdown_Options!$B$2:$B$${categoryOptions.length + 1}`],
      showErrorMessage: true,
      errorTitle: 'Invalid Category',
      error: 'Please select a category: TG Mining, VLTD, VLTD + Mining, General.'
    };

    // Column E: Vehicle Model Dropdown
    sheet.getCell(`E${rowIdx}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Dropdown_Options!$C$2:$C$${vehicleModelOptions.length + 1}`],
      showErrorMessage: false,
      promptTitle: 'Vehicle Model',
      prompt: 'Select from dropdown or enter custom make/model (e.g. Tipper, Tata Prima).'
    };

    // Column M: Engine ON Status Dropdown
    sheet.getCell(`M${rowIdx}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Dropdown_Options!$D$2:$D$${engineOnOptions.length + 1}`],
      showErrorMessage: true,
      errorTitle: 'Invalid Engine ON Status',
      error: 'Please select from: Voltage+Ignition, Ignition, Voltage, Digital Input 1.'
    };

    // Column O: Timezone Dropdown
    sheet.getCell(`O${rowIdx}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Dropdown_Options!$E$2:$E$${timezoneOptions.length + 1}`],
      showErrorMessage: false
    };

    // Column T: GROUP Dropdown
    sheet.getCell(`T${rowIdx}`).dataValidation = {
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
    { colName: 'Device Type', hasDropdown: 'YES (Dropdown)', req: 'YES', desc: 'AIS140, BSTPL, CONCOX, FMB920, VOLTY, AIS140 V2, GT06N.' },
    { colName: 'Device ID(IMEI)', hasDropdown: 'NO', req: 'YES', desc: '15-digit unique GPS device IMEI number.' },
    { colName: 'Category', hasDropdown: 'YES (Dropdown)', req: 'YES', desc: 'TG Mining, VLTD, VLTD + Mining, General.' },
    { colName: 'Vehicle Id', hasDropdown: 'NO', req: 'YES', desc: 'Vehicle registration plate number / identifier (e.g. TS09AB1234).' },
    { colName: 'Vehicle Model', hasDropdown: 'YES (Dropdown)', req: 'NO', desc: 'Truck, Tipper, Tanker, Bus, Car, Tractor, JCB, etc.' },
    { colName: 'VLTTD SLNO', hasDropdown: 'NO', req: 'NO', desc: 'VLT device compliance serial number.' },
    { colName: 'ICCID', hasDropdown: 'NO', req: 'NO', desc: 'SIM card ICCID number (19-20 digits).' },
    { colName: 'GPS SIMNO1 / SIMNO2', hasDropdown: 'NO', req: 'NO', desc: 'Primary and secondary 10-digit SIM mobile numbers.' },
    { colName: 'Chassis / Engine Number', hasDropdown: 'NO', req: 'NO', desc: 'Vehicle chassis/VIN and engine serial numbers.' },
    { colName: 'Sensor No', hasDropdown: 'NO', req: 'NO', desc: 'Fuel / Temperature sensor hardware identifier.' },
    { colName: 'engine on status', hasDropdown: 'YES (Dropdown)', req: 'NO', desc: 'Voltage+Ignition, Ignition, Voltage, Digital Input 1.' },
    { colName: 'vehicle voltage', hasDropdown: 'NO', req: 'NO', desc: '12V, 24V, etc.' },
    { colName: 'timezone', hasDropdown: 'YES (Dropdown)', req: 'NO', desc: 'Default IST.' },
    { colName: 'service engineer & mobile', hasDropdown: 'NO', req: 'NO', desc: 'Technician name and phone number.' },
    { colName: 'Salesman & mobile', hasDropdown: 'NO', req: 'NO', desc: 'Sales executive name and phone number.' },
    { colName: 'GROUP / OLD GROUPS', hasDropdown: 'YES (Dropdown)', req: 'NO', desc: 'Active assigned group(s) and historical group tags.' },
    { colName: 'Owner name & mobile', hasDropdown: 'NO', req: 'NO', desc: 'Client / vehicle owner contact details.' },
    { colName: 'Owner AADHAR / PAN', hasDropdown: 'NO', req: 'NO', desc: 'Client KYC verification document numbers.' },
    { colName: 'OWNER /RTO LOCATION', hasDropdown: 'NO', req: 'NO', desc: 'RTO circle or client operational headquarters.' },
    { colName: 'Installed Date', hasDropdown: 'NO', req: 'NO', desc: 'Installation date in YYYY-MM-DD format.' },
    { colName: 'Username / password / Email', hasDropdown: 'NO', req: 'NO', desc: 'Customer web portal login credentials. Creates account automatically.' }
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
