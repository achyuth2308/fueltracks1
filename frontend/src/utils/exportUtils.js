import { formatLocalTime } from './dateUtils';
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

  // Auto-fit column widths
  const keys = Object.keys(data[0] || {});
  const colWidths = keys.map(key => {
    const maxValLen = data.reduce((max, r) => Math.max(max, String(r[key] || '').length), key.length);
    return { wch: Math.min(Math.max(maxValLen + 2, 10), 50) };
  });
  worksheet['!cols'] = colWidths;

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
  
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(title, 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text(`Generated on: ${formatLocalTime(new Date())}`, 14, 21);

  // Map data to match columns layout
  const tableData = data.map(row => {
    return columns.map(col => {
      // Find the key in the row that loosely matches the column name
      const key = Object.keys(row).find(k => k.toLowerCase().replace(/_/g, ' ') === col.toLowerCase());
      return row[key] !== undefined && row[key] !== null ? String(row[key]) : '-';
    });
  });

  autoTable(doc, {
    head: [columns],
    body: tableData,
    startY: 26,
    styles: { fontSize: 8, cellPadding: 3, textColor: [30, 41, 59] },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 }
  });

  doc.save(`${(fileName || title).replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};
