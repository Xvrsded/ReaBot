const mongoose = require('mongoose');

const moderationCaseSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  moderatorId: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    default: 'WARN'
  },
  reason: {
    type: String,
    required: true,
    default: 'No reason provided'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ModerationCase', moderationCaseSchema);
