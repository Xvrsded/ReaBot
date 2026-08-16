const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config/config');
const logger = require('../utils/logger');
const VerificationState = require('../models/VerificationState');

/**
 * Builds the verification embed message and action row button
 */
function createVerificationPayload() {
  const embed = new EmbedBuilder()
    .setTitle('🛡️ SERVER VERIFICATION')
    .setColor(0x5865F2)
    .setDescription(
      '🇬🇧 **ENGLISH**\n\n' +
      'Welcome to the server!\n\n' +
      'Please read our rules before verifying yourself.\n\n' +
      'Click **Read Rules** below to open the Rules channel.\n' +
      'After reading the rules, return here and click **Verify**.\n\n' +
      '🇮🇩 **INDONESIA**\n\n' +
      'Selamat datang di server!\n\n' +
      'Silakan baca rules terlebih dahulu sebelum melakukan verifikasi.\n\n' +
      'Tekan **Read Rules** di bawah untuk membuka channel Rules.\n' +
      'Setelah membaca rules, kembali ke sini dan tekan **Verify**.'
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verification_rules')
      .setLabel('Read Rules')
      .setEmoji('📜')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('verification_verify')
      .setLabel('Verify')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
  );

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
      logger.warn(`Verification channel (${config.channels.verification}) not found or is not a text channel.`);
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
      (m) => m.author.id === client.user.id && m.components.length > 0 && m.components[0].components.some((c) => c.customId === 'verification_verify' || c.customId === 'verify')
    );

    if (botVerifyMessage) {
      await botVerifyMessage.edit(payload);
      logger.info(`Found and reused existing verification message (${botVerifyMessage.id}).`);
      return;
    }

    // Otherwise create a new one
    const newMessage = await channel.send(payload);
    logger.info(`Verification message created successfully (ID: ${newMessage.id}).`);
    
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
 * Handles the verify and rules button clicks
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleVerificationButton(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (interaction.customId === 'verification_rules') {
    // Record that the user viewed the rules
    try {
      await VerificationState.findOneAndUpdate(
        { guildId: interaction.guildId, userId: interaction.user.id },
        { rulesViewedAt: new Date() },
        { upsert: true }
      );
    } catch (err) {
      logger.error('Failed to save rulesViewedAt state:', err);
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Open Rules')
        .setEmoji('📜')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${interaction.guildId || process.env.GUILD_ID}/${config.channels.rules}`)
    );

    return interaction.editReply({
      content: '🇬🇧 **ENGLISH**\n\n' +
               'Please read the rules carefully in the channel below.\n\n' +
               '🇮🇩 **INDONESIA**\n\n' +
               'Silakan baca rules dengan teliti pada channel di bawah.',
      components: [row]
    });
  }

  if (interaction.customId === 'verification_verify') {
    const roleId = config.roles.member;
    const member = interaction.member;

    if (!roleId) {
      return interaction.editReply({
        content: '❌ Member role belum dikonfigurasi di server. Hubungi administrator.'
      });
    }

    if (!member) {
      return interaction.editReply({
        content: '❌ Gagal memverifikasi: Data member tidak ditemukan.'
      });
    }

    if (member.roles.cache.has(roleId)) {
      return interaction.editReply({
        content: '🇬🇧 **ENGLISH**\n\nYou are already verified.\n\n🇮🇩 **INDONESIA**\n\nKamu sudah terverifikasi.'
      });
    }

    // Check if user has read the rules
    const state = await VerificationState.findOne({ guildId: interaction.guildId, userId: interaction.user.id });
    
    if (!state || !state.rulesViewedAt) {
      return interaction.editReply({
        content: '🛡️ **VERIFICATION REQUIRED**\n\n' +
                 '🇬🇧 **ENGLISH**\n\n' +
                 'Please read the server rules first.\n\n' +
                 'Click the "Read Rules" button below to open the Rules channel.\n' +
                 'After reading the rules, return here and try verifying again.\n\n' +
                 '🇮🇩 **INDONESIA**\n\n' +
                 'Silakan baca rules server terlebih dahulu.\n\n' +
                 'Tekan tombol "Read Rules" di bawah untuk membuka channel Rules.\n' +
                 'Setelah membacanya, kembali ke sini dan coba verifikasi lagi.'
      });
    }

    try {
      await member.roles.add(roleId);
      
      // Update verifiedAt state
      await VerificationState.findOneAndUpdate(
        { guildId: interaction.guildId, userId: interaction.user.id },
        { verifiedAt: new Date() }
      );

      return interaction.editReply({
        content: '✅ **Verification successful!**\n\nYou now have access to the server.\n\n' +
                 '✅ **Verifikasi berhasil!**\n\nSekarang kamu sudah mendapatkan akses ke server.'
      });
    } catch (error) {
      logger.error(`Failed to assign member role to ${member.user?.tag || member.id}:`, error);

      return interaction.editReply({
        content: '❌ **Verification failed.**\n\n' +
                 '🇬🇧 **ENGLISH**\n\n' +
                 'I couldn\'t give you the Member role.\n' +
                 'Please try again later.\n\n' +
                 '🇮🇩 **INDONESIA**\n\n' +
                 'Bot tidak dapat memberikan role Member.\n' +
                 'Silakan coba lagi nanti.'
      });
    }
  }
}

module.exports = {
  initVerificationMessage,
  handleVerificationButton
};
