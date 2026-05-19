/**
 * Formats a Kromer balance for display with proper decimal places and thousands separators
 * @param amount The Kromer amount to format
 * @param maxPrecision The maximum number of decimal places to display
 * @returns The formatted amount string (e.g., "1,234.56")
 */
export function formatKromerAmount(amount: number, maxPrecision: number = 5): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxPrecision,
  });
}

/**
 * Formats a Kromer balance for display with the "KRO" suffix
 * @param amount The Kromer amount to format
 * @param maxPrecision The maximum number of decimal places to display
 * @returns The formatted amount string with suffix (e.g., "1,234.56 KRO")
 */
export function formatKromerBalance(amount: number, maxPrecision?: number): string {
  return `${formatKromerAmount(amount, maxPrecision)} KRO`;
}
