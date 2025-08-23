const express = require('express');
const router = express.Router();
const Content = require('../models/Content');
const aiService = require('../services/aiService');

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
      videos: content.filter(item => item.contentType === 'tiktok'),
      screenshots: content.filter(item => item.contentType === 'screenshot'),
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

// Save new content
router.post('/save', async (req, res) => {
  try {
    const { deviceId, url, contentType } = req.body;
    
    if (!deviceId || !url || !contentType) {
      return res.status(400).json({ 
        success: false, 
        error: 'deviceId, url, and contentType are required' 
      });
    }
    
    // Use AI to analyze content
    const analysis = await aiService.analyzeContent(url, contentType);
    
    const content = new Content({
      deviceId,
      url,
      contentType,
      title: analysis.title,
      description: analysis.description,
      aiTags: analysis.tags,
      thumbnail: analysis.thumbnail
    });
    
    await content.save();
    
    res.json({ 
      success: true, 
      data: content,
      message: 'Content saved successfully!'
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

module.exports = router;
