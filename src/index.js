const fs = require('fs');
const path = require('path');
const {
  Client,
  Collection,
  GatewayIntentBits,
  REST,
  Routes
} = require('discord.js');
const mongoose = require('mongoose');
const config = require('./config/config');
const logger = require('./utils/logger');

async function main() {
  console.log('========================================');
  console.log(' ReaBot Discord Bot');
  console.log('========================================\n');

  logger.info('Loading configuration...');

  // Validate critical credentials
  if (!config.token) {
    logger.error('DISCORD_TOKEN is missing! Please configure it in your .env file.');
  }

  if (!config.mongoUri) {
    logger.warn('MONGODB_URI is missing in .env! Database features (moderation cases) will not function until configured.');
  } else {
    logger.info('Connecting to MongoDB...');
    try {
      await mongoose.connect(config.mongoUri);
      logger.info('MongoDB connected.');
    } catch (err) {
      logger.error('Failed to connect to MongoDB:', err.message);
    }
  }

  // Initialize Discord Client with required intents
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildBans,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  client.commands = new Collection();
  const commandsData = [];

  // Load Commands
  logger.info('Loading commands...');
  const commandsPath = path.join(__dirname, 'commands');
  if (fs.existsSync(commandsPath)) {
    const commandFolders = fs.readdirSync(commandsPath);
    for (const folder of commandFolders) {
      const folderPath = path.join(commandsPath, folder);
      if (fs.statSync(folderPath).isDirectory()) {
        const commandFiles = fs.readdirSync(folderPath).filter((file) => file.endsWith('.js'));
        for (const file of commandFiles) {
          const filePath = path.join(folderPath, file);
          const command = require(filePath);
          if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            commandsData.push(command.data.toJSON());
          } else {
            logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
          }
        }
      }
    }
  }
  logger.info(`Commands loaded: ${client.commands.size}`);

  // Register Slash Commands via Discord REST API if token is provided
  if (config.token && commandsData.length > 0) {
    const rest = new REST().setToken(config.token);
    try {
      logger.info(`Registering ${commandsData.length} application (/) commands...`);
      if (config.guildId) {
        // Guild-specific registration (instant propagation for development/server)
        await rest.put(
          Routes.applicationGuildCommands(
            Buffer.from(config.token.split('.')[0], 'base64').toString('ascii'),
            config.guildId
          ),
          { body: commandsData }
        );
        logger.info(`Successfully registered application commands for Guild ID: ${config.guildId}`);
      }
    } catch (error) {
      logger.warn(`Failed to register slash commands via REST (may auto-register upon login or if bot ID differs): ${error.message}`);
    }
  }

  // Load Events
  logger.info('Loading events...');
  const eventsPath = path.join(__dirname, 'events');
  if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'));
    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      const event = require(filePath);
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
      } else {
        client.on(event.name, (...args) => event.execute(...args));
      }
    }
  }
  logger.info('Events loaded.');

  // Login to Discord
  if (config.token) {
    logger.info('Connecting to Discord...');
    try {
      await client.login(config.token);
    } catch (error) {
      logger.error('Failed to log in to Discord:', error.message);
    }
  } else {
    logger.warn('Skipping Discord login: DISCORD_TOKEN is empty. Set your token in .env and run `npm run bot`.');
  }

  // Graceful shutdown handling
  const shutdown = async () => {
    logger.info('Shutting down ReaBot gracefully...');
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      logger.info('MongoDB disconnected.');
    }
    client.destroy();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error('Unexpected fatal error in ReaBot main process:', err);
});
