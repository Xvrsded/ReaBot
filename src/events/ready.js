const { Events } = require('discord.js');
const { initVerificationMessage } = require('../services/verificationService');
const logger = require('../utils/logger');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    logger.info(`Logged in as ${client.user.tag}`);
    logger.info('ReaBot is ready.');

    // Initialize verification message embed in verification channel
    await initVerificationMessage(client);

    // Initialize Streamer System
    const { initStreamerRegistrationMessage, startStreamMonitor } = require('../services/streamerService');
    await initStreamerRegistrationMessage(client);
    startStreamMonitor(client);
  }
};
