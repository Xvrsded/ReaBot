const mongoose = require('mongoose');

const StreamerAccountSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  discordUserId: { type: String, required: true },
  platform: { type: String, required: true }, // e.g., 'tiktok', 'twitch'
  username: { type: String, required: true },
  displayName: { type: String },
  liveStatus: { type: Boolean, default: false },
  liveUrl: { type: String },
  lastLiveAt: { type: Date },
  lastCheckedAt: { type: Date },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

// Prevent same user from registering the exact same platform & username twice
StreamerAccountSchema.index({ discordUserId: 1, platform: 1, username: 1 }, { unique: true });
// Ensure one username per platform isn't claimed by someone else if we want it globally unique per server
StreamerAccountSchema.index({ guildId: 1, platform: 1, username: 1 }, { unique: true });

module.exports = mongoose.model('StreamerAccount', StreamerAccountSchema);
