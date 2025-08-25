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
    default: 'Processing...'
  },
  contentType: {
    type: String,
    enum: ['tiktok', 'screenshot', 'other', 'video', 'image'],
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
  },
  // New fields for background processing
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processedAt: {
    type: Date
  },
  errorMessage: {
    type: String
  },
  // SORTD-STYLE FIELDS
  category: {
    type: String,
    default: 'other'
  },
  structuredData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  insights: [{
    icon: String,
    title: String,
    text: String
  }],
  displaySummary: {
    type: String,
    default: ''
  }
});

// Index for better search performance
contentSchema.index({ deviceId: 1, aiTags: 1 });
contentSchema.index({ deviceId: 1, savedAt: -1 });
contentSchema.index({ processingStatus: 1, savedAt: 1 }); // For background job processing

module.exports = mongoose.model('Content', contentSchema);
