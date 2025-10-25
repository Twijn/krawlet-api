import {
  SlashCommandBuilder,
  CommandInteraction,
  MessageFlagsBitField,
  APIEmbed,
  Message,
  InteractionResponse,
  ChatInputCommandInteraction,
  SlashCommandSubcommandsOnlyBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  AutocompleteInteraction,
} from 'discord.js';
import { KromerApi } from 'kromer';
import kromer from '../../../lib/kromer';
import { getStandardFooter } from '../../utils/embedFooter';

export interface InteractionHelper {
  kromer: KromerApi;
  success: (message: string, embed?: APIEmbed) => Promise<Message | InteractionResponse>;
  warning: (message: string, embed?: APIEmbed) => Promise<Message | InteractionResponse>;
  reply: (
    message: string,
    title: string,
    embed?: APIEmbed,
  ) => Promise<Message | InteractionResponse>;
  error: (message: string, embed?: APIEmbed) => Promise<Message | InteractionResponse>;
}

export interface AutocompleteHelper {
  kromer: KromerApi;
}

export function createInteractionHelper(interaction: CommandInteraction): InteractionHelper {
  const sendEmbed = async (
    color: number,
    title: string,
    message: string,
    embed: APIEmbed = {},
  ): Promise<Message | InteractionResponse> => {
    embed = {
      ...embed,
      color: color,
      title: title,
      description: message,
      footer: embed.footer || getStandardFooter(),
    };

    if (interaction.replied || interaction.deferred) {
      return await interaction.editReply({ embeds: [embed] });
    } else {
      return await interaction.reply({
        embeds: [embed],
        flags: [MessageFlagsBitField.Flags.Ephemeral],
      });
    }
  };

  return {
    kromer: kromer,
    success: async (message: string, embed: APIEmbed = {}) => {
      return await sendEmbed(0x4cd987, 'Success', message, embed); // #4cd987
    },
    warning: async (message: string, embed: APIEmbed = {}) => {
      return await sendEmbed(0xf2c94c, 'Warning', message, embed); // #f2c94c
    },
    reply: async (message: string, title: string, embed: APIEmbed = {}) => {
      return await sendEmbed(0x208eb8, title, message, embed); // #208eb8
    },
    error: async (message: string, embed: APIEmbed = {}) => {
      return await sendEmbed(0xf54242, 'Error', message, embed); // #f54242
    },
  };
}

export function createAutocompleteHelper(
  _interaction: AutocompleteInteraction,
): AutocompleteHelper {
  return {
    kromer: kromer,
  };
}

export interface DiscordCommand {
  data:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandBuilder
    | SlashCommandSubcommandGroupBuilder;
  defer?: boolean;
  execute: (interaction: ChatInputCommandInteraction, helper: InteractionHelper) => Promise<void>;
  autocomplete?: (
    interaction: AutocompleteInteraction,
    helper: AutocompleteHelper,
  ) => Promise<void>;
}
