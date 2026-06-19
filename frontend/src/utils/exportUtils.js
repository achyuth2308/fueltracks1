import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Export data to Excel
 * @param {Array} data - Array of objects
 * @param {string} fileName - Base filename
 */
export const exportToExcel = (data, fileName) => {
  if (!data || data.length === 0) return;
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

/**
 * Export data to CSV
 * @param {Array} data - Array of objects
 * @param {string} fileName - Base filename
 */
export const exportToCSV = (data, fileName) => {
  if (!data || data.length === 0) return;
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${fileName}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
};

/**
 * Export data to PDF
 * @param {Array} columns - Array of column header strings
 * @param {Array} data - Array of objects
 * @param {string} title - Document title
 * @param {string} fileName - Base filename
 */
export const exportToPDF = (columns, data, title, fileName) => {
  if (!data || data.length === 0) return;
  const doc = new jsPDF('landscape');
  
  doc.setFontSize(16);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

  // Map data to match columns layout
  const tableData = data.map(row => {
    return columns.map(col => {
      // Find the key in the row that loosely matches the column name
      const key = Object.keys(row).find(k => k.toLowerCase().replace(/_/g, ' ') === col.toLowerCase());
      return row[key] !== undefined ? String(row[key]) : '-';
    });
  });

  autoTable(doc, {
    head: [columns],
    body: tableData,
    startY: 28,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [139, 160, 181] }
  });

  doc.save(`${fileName}_${new Date().toISOString().split('T')[0]}.pdf`);
};
