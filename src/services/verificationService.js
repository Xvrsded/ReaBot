const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Builds the verification embed message and action row button
 */
function createVerificationPayload() {
  const embed = new EmbedBuilder()
    .setTitle('🛡️ Server Verification')
    .setColor(0x5865F2)
    .setDescription(
      'Selamat datang di server!\n\n' +
      'Untuk menjaga keamanan server dan mencegah raid/spam, member baru harus melakukan verification terlebih dahulu.\n\n' +
      'Silakan baca rules server sebelum melakukan verification.\n\n' +
      'Setelah siap, tekan tombol di bawah untuk mendapatkan akses sebagai Member.'
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify')
      .setLabel('Verify')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
  );

  if (config.channels.rules) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel('Read Rules')
        .setEmoji('📜')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${config.guildId}/${config.channels.rules}`)
    );
  }

  return { embeds: [embed], components: [row] };
}

/**
 * Ensures the verification message exists and is idempotent
 * @param {import('discord.js').Client} client
 */
async function initVerificationMessage(client) {
  if (!config.channels.verification) {
    logger.warn('VERIFICATION_CHANNEL_ID is not configured. Skipping verification message setup.');
    return;
  }

  try {
    const channel = await client.channels.fetch(config.channels.verification).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      logger.warn(`Verification channel (${config.verificationChannelId}) not found or is not a text channel.`);
      return;
    }

    const payload = createVerificationPayload();

    const AppConfig = require('../models/AppConfig');
    const savedMsgConfig = await AppConfig.findOne({ key: 'verificationMessageId' });
    
    if (savedMsgConfig && savedMsgConfig.value) {
      try {
        const existingMessage = await channel.messages.fetch(savedMsgConfig.value);
        if (existingMessage) {
          await existingMessage.edit(payload);
          logger.info(`Existing verification message (${savedMsgConfig.value}) updated.`);
          return;
        }
      } catch (err) {
        logger.warn(`Could not fetch saved verification message (${savedMsgConfig.value}).`);
      }
    }

    // Look for existing verification message sent by the bot in recent messages
    const recentMessages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    const botVerifyMessage = recentMessages?.find(
      (m) => m.author.id === client.user.id && m.components.length > 0 && m.components[0].components.some((c) => c.customId === 'verify')
    );

    if (botVerifyMessage) {
      await botVerifyMessage.edit(payload);
      logger.info(`Found and reused existing verification message (${botVerifyMessage.id}).`);
      return;
    }

    // Otherwise create a new one
    const newMessage = await channel.send(payload);
    logger.info(`Verification message created successfully (ID: ${newMessage.id}).`);
    
    // We will save it to DB using AppConfig (to be implemented)
    await AppConfig.findOneAndUpdate(
      { key: 'verificationMessageId' },
      { value: newMessage.id },
      { upsert: true }
    );
    
  } catch (error) {
    logger.error('Failed to initialize verification message:', error);
  }
}

/**
 * Handles the verify button click
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleVerificationButton(interaction) {
  if (interaction.customId !== 'verify') return;

  const roleId = config.roles.member;
  if (!roleId) {
    return interaction.reply({
      content: '❌ Member role belum dikonfigurasi di server. Hubungi administrator.',
      ephemeral: true
    });
  }

  const member = interaction.member;
  if (!member) {
    return interaction.reply({
      content: '❌ Gagal memverifikasi: Data member tidak ditemukan.',
      ephemeral: true
    });
  }

  try {
    if (member.roles.cache.has(roleId)) {
      return interaction.reply({
        content: 'ℹ️ Kamu sudah terverifikasi sebagai Member.',
        ephemeral: true
      });
    }

    await member.roles.add(roleId);
    return interaction.reply({
      content: '✅ Verification berhasil!\n\nKamu sekarang sudah mendapatkan role Member dan dapat mengakses channel server.',
      ephemeral: true
    });
  } catch (error) {
    logger.error(`Failed to assign member role to ${member.user?.tag || member.id}:`, error);

    return interaction.reply({
      content: '❌ Terjadi kesalahan saat memberikan role verifikasi. Pastikan role bot memiliki izin `Manage Roles` dan posisinya berada di atas `Member Role`.',
      ephemeral: true
    });
  }
}

module.exports = {
  initVerificationMessage,
  handleVerificationButton
};
