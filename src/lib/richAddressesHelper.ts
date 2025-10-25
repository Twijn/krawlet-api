import kromer from './kromer';
import { AddressesResponse } from 'kromer';

export interface RichAddressesOptions {
  limit: number;
  offset?: number;
}

export interface FilteredRichAddressesResponse {
  addresses: AddressesResponse['addresses'];
  total: number;
  originalTotal: number;
}

/**
 * Gets rich addresses while excluding the "serverwelf" address
 * This helper ensures consistent behavior across Discord and chat commands
 */
export async function getRichAddressesExcludingServerwelf(
  options: RichAddressesOptions,
): Promise<FilteredRichAddressesResponse> {
  const { limit, offset = 0 } = options;

  // Fetch one extra address to account for potential serverwelf exclusion
  // This ensures we always have the requested number of addresses (if available)
  const fetchLimit = limit + 1;

  const response = await kromer.addresses.getRich({
    limit: fetchLimit,
    offset,
  });

  // Filter out serverwelf if it exists in the results
  const filteredAddresses = response.addresses.filter((addr) => addr.address !== 'serverwelf');

  // Take only the requested number of addresses after filtering
  const finalAddresses = filteredAddresses.slice(0, limit);

  return {
    addresses: finalAddresses,
    total: Math.max(0, response.total - 1), // Subtract 1 from total to account for serverwelf exclusion
    originalTotal: response.total,
  };
}
