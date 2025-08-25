const express = require('express');
const router = express.Router();
const Content = require('../models/Content');
const aiService = require('../services/aiService');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo',
  api_key: process.env.CLOUDINARY_API_KEY || 'demo',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'demo'
});

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
const { extractBasicTitle, detectContentType, getPlaceholderThumbnail } = require('../utils/urlUtils');

// Get all content for a device
router.get('/content/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { type, limit = 50, page = 1 } = req.query;
    
    let filter = { deviceId };
    if (type) {
      filter.contentType = type;
    }
    
    const skip = (page - 1) * limit;
    const content = await Content.find(filter)
      .sort({ savedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Group by content type for organized display
    const grouped = {
      videos: content.filter(item => 
        item.contentType === 'tiktok' || 
        item.contentType === 'video'
      ),
      screenshots: content.filter(item => 
        item.contentType === 'screenshot' || 
        item.contentType === 'image'
      ),
      recent: content.slice(0, 6) // Last 6 items
    };
    
    res.json({ 
      success: true, 
      data: grouped,
      total: content.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save new content (INSTANT RESPONSE with background processing)
router.post('/save', async (req, res) => {
  try {
    const { deviceId, url, contentType: providedType } = req.body;
    
    if (!deviceId || !url) {
      return res.status(400).json({ 
        success: false, 
        error: 'deviceId and url are required' 
      });
    }
    
    // Auto-detect content type if not provided
    const contentType = providedType || detectContentType(url);
    console.log('\n[SAVE] New content', { deviceId, url, providedType, detectedType: contentType });
    
    // Create content immediately with basic metadata
    const content = new Content({
      deviceId,
      url,
      contentType,
      title: extractBasicTitle(url),
      description: 'AI analysis in progress...',
      aiTags: [contentType], // Basic tag while processing
      thumbnail: getPlaceholderThumbnail(contentType),
      processingStatus: 'pending'
    });
    
    await content.save();
    console.log('[SAVE] Created content', { id: content._id.toString(), contentType: content.contentType, title: content.title });
    
    // Queue for background AI processing (we'll implement the worker next)
    // For now, we'll process immediately in background
    processContentInBackground(content._id);
    
    // Return immediately with success
    res.json({ 
      success: true, 
      data: content,
      message: 'Content saved! AI analysis in progress...'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Background processing function
async function processContentInBackground(contentId) {
  try {
    // Run in background without blocking the response
    setTimeout(async () => {
      try {
        const content = await Content.findById(contentId);
        if (!content || content.processingStatus !== 'pending') {
          return;
        }
        
        // Update status to processing
        content.processingStatus = 'processing';
        await content.save();
        
        // Run AI analysis
        console.log('[AI] Starting analysis', { id: content._id.toString(), type: content.contentType, url: content.url });
        const analysis = await aiService.analyzeContent(content.url, content.contentType);
        console.log('[AI] Analysis result', { id: content._id.toString(), title: analysis?.title, tags: analysis?.tags });
        
        // Update with AI results
        content.title = analysis.title || content.title;
        content.description = analysis.description || '';
        content.aiTags = analysis.tags || [content.contentType];
        content.thumbnail = analysis.thumbnail || content.thumbnail;
        // SORTD-STYLE FIELDS
        content.category = analysis.category || 'other';
        content.structuredData = analysis.structuredData || {};
        content.insights = analysis.insights || [];
        content.displaySummary = analysis.displaySummary || '';
        content.processingStatus = 'completed';
        content.processedAt = new Date();
        
        await content.save();
        
        console.log(`✅ Background processing completed for content ${contentId}`);
      } catch (error) {
        console.error(`❌ Background processing failed for content ${contentId}:`, error);
        
        // Update with error status
        await Content.findByIdAndUpdate(contentId, {
          processingStatus: 'failed',
          errorMessage: error.message,
          processedAt: new Date()
        });
      }
    }, 100); // Process after 100ms to ensure response is sent
  } catch (error) {
    console.error('Error queuing background job:', error);
  }
}

// Reprocess content that's stuck in pending
router.post('/reprocess/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    
    const content = await Content.findById(contentId);
    if (!content) {
      return res.status(404).json({ 
        success: false, 
        error: 'Content not found' 
      });
    }
    
    // Force reprocess
    processContentInBackground(contentId);
    
    res.json({ 
      success: true, 
      message: 'Content queued for reprocessing' 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search content
router.get('/search/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { query, type } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        error: 'Search query is required' 
      });
    }
    
    // Build search filter
    let filter = { 
      deviceId,
      $or: [
        { aiTags: { $regex: query, $options: 'i' } },
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    };
    
    if (type) {
      filter.contentType = type;
    }
    
    const results = await Content.find(filter)
      .sort({ savedAt: -1 })
      .limit(20);
    
    res.json({ 
      success: true, 
      data: results,
      query,
      total: results.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single content item
router.get('/content/:deviceId/:contentId', async (req, res) => {
  try {
    const { deviceId, contentId } = req.params;
    
    const content = await Content.findOne({ 
      _id: contentId, 
      deviceId 
    });
    
    if (!content) {
      return res.status(404).json({ 
        success: false, 
        error: 'Content not found' 
      });
    }
    
    // Increment view count
    content.viewCount += 1;
    await content.save();
    
    res.json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get processing status for content
router.get('/status/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const stats = await Content.aggregate([
      { $match: { deviceId } },
      { 
        $group: {
          _id: '$processingStatus',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const statusMap = {};
    stats.forEach(stat => {
      statusMap[stat._id] = stat.count;
    });
    
    res.json({ 
      success: true, 
      data: {
        pending: statusMap.pending || 0,
        processing: statusMap.processing || 0,
        completed: statusMap.completed || 0,
        failed: statusMap.failed || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete content
router.delete('/content/:deviceId/:contentId', async (req, res) => {
  try {
    const { deviceId, contentId } = req.params;
    
    const result = await Content.deleteOne({ 
      _id: contentId, 
      deviceId 
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Content not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Content deleted successfully' 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Image upload endpoint
router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided' });
    }

    console.log('📸 Processing image upload...');
    
    // For now, convert image to base64 data URL for direct GPT-4 Vision analysis
    // This avoids the need for external image hosting
    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    
    console.log('✅ Image converted to data URL for AI analysis');
    
    res.json({ 
      success: true, 
      imageUrl: dataUrl,
      message: 'Image ready for AI analysis'
    });
  } catch (error) {
    console.error('❌ Image processing failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Image processing failed',
      details: error.message 
    });
  }
});

module.exports = router;
