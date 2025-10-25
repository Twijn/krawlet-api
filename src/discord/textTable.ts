export type ColumnAlignment = 'left' | 'right' | 'center';

export function createTextTable(
  headers: string[] | null,
  rows: string[][],
  alignments?: ColumnAlignment[],
): string {
  const hasHeaders = headers && headers.length > 0;
  const allRows = hasHeaders ? [headers, ...rows] : rows;

  // Calculate the maximum width for each column
  const columnCount = Math.max(...allRows.map((row) => row.length));
  const columnWidths: number[] = [];

  for (let colIndex = 0; colIndex < columnCount; colIndex++) {
    let maxWidth = 0;
    for (const row of allRows) {
      if (row[colIndex]) {
        maxWidth = Math.max(maxWidth, row[colIndex].length);
      }
    }
    columnWidths[colIndex] = maxWidth;
  }

  // Helper function to pad strings to the correct width with alignment
  const padString = (str: string, width: number, alignment: ColumnAlignment = 'left') => {
    if (alignment === 'right') {
      return str.padStart(width, ' ');
    } else if (alignment === 'center') {
      const padding = width - str.length;
      const leftPadding = Math.floor(padding / 2);
      const rightPadding = padding - leftPadding;
      return ' '.repeat(leftPadding) + str + ' '.repeat(rightPadding);
    } else {
      return str.padEnd(width, ' ');
    }
  };

  // Create the formatted table
  let table = '';

  // Add header row if headers are provided
  if (hasHeaders) {
    const headerRow = headers
      .map((header, index) => padString(header, columnWidths[index], alignments?.[index] || 'left'))
      .join(' │ ');
    table += headerRow + '\n';

    // Add separator row
    const separatorRow = columnWidths.map((width) => '─'.repeat(width)).join('─┼─');
    table += separatorRow + '\n';
  }

  // Add data rows
  for (const row of rows) {
    const formattedRow = row
      .map((cell, index) =>
        padString(cell || '', columnWidths[index], alignments?.[index] || 'left'),
      )
      .join(' │ ');
    table += formattedRow + '\n';
  }

  return `\`\`\`\n${table}\`\`\``;
}
export default createTextTable;
