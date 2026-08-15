const mongoose = require('mongoose');

const UserActivitySchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  lastChannelId: { type: String, required: true },
  lastMessageId: { type: String },
  lastActivityTimestamp: { type: Date, default: Date.now }
}, { timestamps: true });

UserActivitySchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('UserActivity', UserActivitySchema);
