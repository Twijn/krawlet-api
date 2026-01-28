import { Command } from '../../lib/types';
import { ChatboxCommand } from 'reconnectedchat';
import { rcc } from '../index';

/**
 * MiniMessage formatting examples and documentation.
 * Reference: https://docs.advntr.dev/minimessage/format.html
 *
 * Note: Some features like copy-to-clipboard may be disabled on this server.
 */

const command: Command = {
  name: 'mini',
  aliases: ['minimessage', 'mm'],
  description: 'Shows MiniMessage formatting examples',
  usage: 'mini [page number]',
  execute: async (cmd: ChatboxCommand) => {
    const arg = cmd.args[0]?.toLowerCase();

    // Group examples into pages for readability
    const pages = [
      {
        title: 'Colors',
        examples: [
          {
            code: '<red>text</red>',
            rendered:
              '<red>Red</red> <green>Green</green> <blue>Blue</blue> <yellow>Yellow</yellow> <gold>Gold</gold> <aqua>Aqua</aqua>',
          },
          {
            code: '<#FF5555>text</>',
            rendered:
              '<#FF5555>Coral</> <#55FF55>Lime</> <#5555FF>Periwinkle</> <#FFaa00>Orange</>',
          },
          {
            code: '<dark_red>text</dark_red>',
            rendered:
              '<dark_red>Dark Red</dark_red> <dark_green>Dark Green</dark_green> <dark_blue>Dark Blue</dark_blue> <dark_gray>Dark Gray</dark_gray>',
          },
          {
            code: '<gradient:red:yellow>text</gradient>',
            rendered: '<gradient:red:yellow:green>This is a gradient!</gradient>',
          },
          {
            code: '<rainbow>text</rainbow>',
            rendered: '<rainbow>This is rainbow text!</rainbow>',
          },
        ],
      },
      {
        title: 'Text Formatting',
        examples: [
          {
            code: '<bold>text</bold> or <b>text</b>',
            rendered: '<bold>This text is bold!</bold>',
          },
          {
            code: '<italic>text</italic> or <i>text</i>',
            rendered: '<italic>This text is italic!</italic>',
          },
          {
            code: '<underlined>text</underlined> or <u>text</u>',
            rendered: '<underlined>This text is underlined!</underlined>',
          },
          {
            code: '<strikethrough>text</strikethrough> or <st>text</st>',
            rendered: '<strikethrough>This text is crossed out!</strikethrough>',
          },
          {
            code: '<obfuscated>text</obfuscated>',
            rendered: '<obfuscated>Spooky!</obfuscated> <gray><- unscrambled: Spooky!</gray>',
          },
          {
            code: '<red><b>combined</b></red>',
            rendered:
              '<red><bold>Bold and red!</bold></red> <gradient:aqua:light_purple><i>Gradient italic!</i></gradient>',
          },
        ],
      },
      {
        title: 'Click Events',
        warning:
          '<red><bold>⚠ Warning:</bold></red> <gray>Click events are present in MiniMessage but</gray> <red>unsupported</red> <gray>by ReconnectedCC chatbox!</gray>',
        examples: [
          {
            code: '<click:open_url:URL>text</click>',
            rendered:
              '<click:open_url:https://www.kromer.club><aqua><u>Click to open kromer.club!</u></aqua></click>',
            note: '<dark_gray>(not functional in chatbox)</dark_gray>',
          },
          {
            code: '<click:run_command:CMD>text</click>',
            rendered: '<click:run_command:\\help><green><u>Click to run \\help</u></green></click>',
            note: '<dark_gray>(not functional in chatbox)</dark_gray>',
          },
          {
            code: '<click:suggest_command:CMD>text</click>',
            rendered:
              '<click:suggest_command:\\bal><yellow><u>Click to suggest \\bal</u></yellow></click>',
            note: '<dark_gray>(not functional in chatbox)</dark_gray>',
          },
        ],
        footer:
          '<green><bold>✓ Alternative:</bold></green> <gray>Use</gray> <yellow>markdown</yellow> <gray>format for links! See page 6.</gray>',
      },
      {
        title: 'Hover Events',
        examples: [
          {
            code: "<hover:show_text:'msg'>text</hover>",
            rendered:
              "<hover:show_text:'<red>Boo! Secret message!</red>'><gold><u>Hover over me!</u></gold></hover>",
          },
          {
            code: 'Combined hover + click',
            rendered:
              "<click:open_url:https://www.kromer.club><hover:show_text:'<gray>Opens kromer.club</gray>'><aqua><u>Hover then click!</u></aqua></hover></click>",
          },
        ],
      },
      {
        title: 'Special',
        examples: [
          {
            code: '<newline> or <br>',
            rendered: '<gray>Line one</gray><newline><gray>Line two</gray>',
          },
          {
            code: '<reset> clears formatting',
            rendered: '<red><bold>Bold red <reset>then normal</reset></bold></red>',
          },
        ],
      },
      {
        title: 'Markdown Links (Recommended!)',
        info: '<green><bold>✓</bold></green> <gray>These work with ReconnectedCC chatbox!</gray>',
        examples: [
          {
            code: '[text](url) - Markdown link format',
            rendered: '<gray>Format:</gray> <yellow>\\[link text](https://example.com)</yellow>',
          },
          {
            code: 'rcc.tell(user, text, name, "markdown")',
            rendered: '<gray>Must specify</gray> <gold>"markdown"</gold> <gray>mode!</gray>',
          },
        ],
        footer: '<yellow>See live example below ↓</yellow>',
        liveMarkdownExample: true,
      },
    ];

    const pageNum = parseInt(arg, 10);

    // Show specific page
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= pages.length) {
      const page = pages[pageNum - 1] as {
        title: string;
        examples: { code: string; rendered: string; note?: string }[];
        warning?: string;
        info?: string;
        footer?: string;
        liveMarkdownExample?: boolean;
      };
      let result = `<gold><bold>MiniMessage: ${page.title}</bold></gold> <gray>(${pageNum}/${pages.length})</gray>\n`;

      // Show warning if present
      if (page.warning) {
        result += `\n${page.warning}\n`;
      }

      // Show info if present
      if (page.info) {
        result += `\n${page.info}\n`;
      }

      for (const ex of page.examples) {
        // Escape angle brackets in code examples so they display as literal text
        const escapedCode = ex.code.replace(/</g, '\\<');
        result += `\n<dark_gray>${escapedCode}</dark_gray>`;
        result += `\n  ${ex.rendered}`;
        if (ex.note) {
          result += ` ${ex.note}`;
        }
        result += '\n';
      }

      // Show footer if present
      if (page.footer) {
        result += `\n${page.footer}`;
      }

      if (pageNum < pages.length) {
        result += `\n<gray>Next:</gray> <yellow>\\mini ${pageNum + 1}</yellow>`;
      }

      rcc.tell(cmd.user, result).catch(console.error);

      // Send live markdown example if this page has one
      if (page.liveMarkdownExample) {
        rcc
          .tell(
            cmd.user,
            '**Live example:** [Visit Kromer!](https://www.kromer.club) ← Click me!',
            undefined,
            'markdown',
          )
          .catch(console.error);
      }

      return;
    }

    // Default: show page index
    let result = '<gold><bold>MiniMessage Examples</bold></gold>';
    result += '\n<dark_gray>Reference: docs.advntr.dev/minimessage/format.html</dark_gray>\n';

    pages.forEach((page, i) => {
      result += `\n<yellow>${i + 1}.</yellow> <white>${page.title}</white> <dark_gray>(${page.examples.length} examples)</dark_gray>`;
    });

    result += `\n\n<gray>Use</gray> <yellow>\\mini [1-${pages.length}]</yellow> <gray>to see a category</gray>`;

    rcc.tell(cmd.user, result).catch(console.error);
  },
};

export default command;
