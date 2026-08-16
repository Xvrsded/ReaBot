const mongoose = require('mongoose');

const StreamerAccountSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  discordUserId: { type: String, required: true },
  platform: { type: String, enum: ['tiktok', 'twitch', 'youtube'], required: true },
  username: { type: String, required: true },
  displayName: { type: String },
  platformUserId: { type: String, required: true }, // For Twitch/YouTube it's the real ID, for TikTok we use username
  liveStatus: { type: Boolean, default: false },
  liveUrl: { type: String },
  streamTitle: { type: String },
  category: { type: String },
  viewerCount: { type: Number },
  thumbnailUrl: { type: String },
  lastLiveAt: { type: Date },
  lastCheckedAt: { type: Date },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

// Ensure uniqueness per platform user ID within a server
StreamerAccountSchema.index({ guildId: 1, platform: 1, platformUserId: 1 }, { unique: true });
// Also ensure username is unique (case insensitive usually, but basic index is fine)
StreamerAccountSchema.index({ guildId: 1, platform: 1, username: 1 }, { unique: true });

module.exports = mongoose.model('StreamerAccount', StreamerAccountSchema);
