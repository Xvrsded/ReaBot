const mongoose = require('mongoose');

const VerificationStateSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  rulesViewedAt: { type: Date },
  verifiedAt: { type: Date }
}, { timestamps: true });

VerificationStateSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('VerificationState', VerificationStateSchema);
