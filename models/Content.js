const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  url: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  contentType: {
    type: String,
    enum: ['tiktok', 'screenshot', 'other'],
    required: true
  },
  aiTags: [{
    type: String,
    index: true
  }],
  description: {
    type: String,
    default: ''
  },
  thumbnail: {
    type: String,
    default: ''
  },
  viewCount: {
    type: Number,
    default: 0
  },
  isFavorite: {
    type: Boolean,
    default: false
  },
  savedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for better search performance
contentSchema.index({ deviceId: 1, aiTags: 1 });
contentSchema.index({ deviceId: 1, savedAt: -1 });

module.exports = mongoose.model('Content', contentSchema);
