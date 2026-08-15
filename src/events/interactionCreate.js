const { Events } = require('discord.js');
const { handleVerificationButton } = require('../services/verificationService');
const logger = require('../utils/logger');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // Handle Slash Commands
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        logger.warn(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        logger.error(`Error executing command /${interaction.commandName}:`, error);
        const replyPayload = {
          content: '❌ Terjadi kesalahan saat menjalankan perintah ini.',
          ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(replyPayload).catch(() => null);
        } else {
          await interaction.reply(replyPayload).catch(() => null);
        }
      }
      return;
    }

    // Handle Button Interactions
    if (interaction.isButton()) {
      try {
        if (interaction.customId === 'verify') {
          await handleVerificationButton(interaction);
        } else if (interaction.customId.startsWith('streamer_')) {
          const { handleStreamerButtons } = require('../services/streamerService');
          await handleStreamerButtons(interaction);
        }
      } catch (error) {
        logger.error('Error handling button interaction:', error);
      }
    }

    // Handle Modal Submissions
    if (interaction.isModalSubmit()) {
      try {
        if (interaction.customId.startsWith('modal_streamer_')) {
          const { handleStreamerModals } = require('../services/streamerService');
          await handleStreamerModals(interaction);
        }
      } catch (error) {
        logger.error('Error handling modal interaction:', error);
      }
    }
  }
};
