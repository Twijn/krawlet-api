/**
 * Formats a Kromer balance for display with proper decimal places and thousands separators
 * @param amount The Kromer amount to format
 * @returns The formatted amount string (e.g., "1,234.56")
 */
export function formatKromerAmount(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formats a Kromer balance for display with the "KRO" suffix
 * @param amount The Kromer amount to format
 * @returns The formatted amount string with suffix (e.g., "1,234.56 KRO")
 */
export function formatKromerBalance(amount: number): string {
  return `${formatKromerAmount(amount)} KRO`;
}
