import { EmbedBuilder } from 'discord.js';
import { getPackageVersion } from '../../lib/packageData';

/**
 * Centralized footer configuration for all Discord embeds
 */
export const FOOTER_CONFIG = {
  text: 'Krawlet Bot',
  iconURL: 'https://www.kromer.club/favicon-96x96.png',
  version: getPackageVersion(),
} as const;

/**
 * Adds a standardized footer to an embed with version information
 * @param embed - The embed to add the footer to
 * @param customText - Optional custom text to prepend to the footer
 * @returns The embed with the footer added
 */
export function addStandardFooter(embed: EmbedBuilder, customText?: string): EmbedBuilder {
  const footerText = customText
    ? `${customText} • ${FOOTER_CONFIG.text} v${FOOTER_CONFIG.version}`
    : `${FOOTER_CONFIG.text} v${FOOTER_CONFIG.version}`;

  return embed.setFooter({
    text: footerText,
    iconURL: FOOTER_CONFIG.iconURL,
  });
}

/**
 * Gets the standardized footer configuration with optional custom text
 * @param customText - Optional custom text to prepend to the footer
 * @returns Footer configuration object
 */
export function getStandardFooter(customText?: string) {
  const footerText = customText
    ? `${customText} • ${FOOTER_CONFIG.text} v${FOOTER_CONFIG.version}`
    : `${FOOTER_CONFIG.text} v${FOOTER_CONFIG.version}`;

  return {
    text: footerText,
    iconURL: FOOTER_CONFIG.iconURL,
  };
}
