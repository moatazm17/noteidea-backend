// Utility functions for URL processing and basic metadata extraction

/**
 * Extract basic title from URL without AI processing
 */
function extractBasicTitle(url) {
  try {
    const urlObj = new URL(url);
    
    // TikTok URLs
    if (urlObj.hostname.includes('tiktok.com')) {
      return 'TikTok Video';
    }
    
    // Image URLs
    if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      const filename = urlObj.pathname.split('/').pop();
      return filename || 'Image';
    }
    
    // YouTube URLs
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      return 'YouTube Video';
    }
    
    // Instagram URLs
    if (urlObj.hostname.includes('instagram.com')) {
      return 'Instagram Post';
    }
    
    // Twitter URLs
    if (urlObj.hostname.includes('twitter.com') || urlObj.hostname.includes('x.com')) {
      return 'Twitter Post';
    }
    
    // Generic fallback
    return urlObj.hostname.replace('www.', '') + ' Content';
  } catch (error) {
    return 'Saved Content';
  }
}

/**
 * Detect content type from URL
 */
function detectContentType(url) {
  try {
    const urlObj = new URL(url);
    
    // Video platforms
    if (urlObj.hostname.includes('tiktok.com') || 
        urlObj.hostname.includes('youtube.com') || 
        urlObj.hostname.includes('youtu.be') ||
        urlObj.hostname.includes('instagram.com')) {
      return 'video';
    }
    
    // Image files
    if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return 'image';
    }
    
    return 'other';
  } catch (error) {
    return 'other';
  }
}

/**
 * Generate basic placeholder thumbnail
 */
function getPlaceholderThumbnail(contentType) {
  const placeholders = {
    video: 'https://via.placeholder.com/300x200/007AFF/FFFFFF?text=📱+Video',
    image: 'https://via.placeholder.com/300x200/28A745/FFFFFF?text=📸+Image',
    other: 'https://via.placeholder.com/300x200/6C757D/FFFFFF?text=🔗+Link'
  };
  
  return placeholders[contentType] || placeholders.other;
}

module.exports = {
  extractBasicTitle,
  detectContentType,
  getPlaceholderThumbnail
};
