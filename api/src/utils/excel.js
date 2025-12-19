import ExcelJS from 'exceljs';

export const workbookToBase64 = async (workbook) => {
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer).toString('base64');
};

export const addSheetFromObjects = (workbook, name, rows) => {
  const sheetName = name.length > 31 ? name.slice(0, 31) : name;
  const sheet = workbook.addWorksheet(sheetName);

  if (!rows || rows.length === 0) {
    return sheet;
  }

  const headers = Object.keys(rows[0]);
  sheet.columns = headers.map((h) => ({ header: h, key: h }));
  rows.forEach((row) => sheet.addRow(row));
  return sheet;
};
