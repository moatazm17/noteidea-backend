const OpenAI = require('openai');
const axios = require('axios');

// Debug OpenAI setup
console.log('🔑 OpenAI API Key Status:', process.env.OPENAI_API_KEY ? 'FOUND' : 'MISSING');

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

if (!openai) {
  console.warn('⚠️  OpenAI not initialized - API key missing. Using fallback analysis.');
}

class AIService {
  async analyzeContent(url, contentType) {
    try {
      if (contentType === 'tiktok') {
        return await this.analyzeTikTokUrl(url);
      } else if (contentType === 'screenshot') {
        return await this.analyzeScreenshot(url);
      } else {
        return await this.analyzeGenericUrl(url);
      }
    } catch (error) {
      console.error('AI Analysis Error:', error);
      // Return fallback data if AI fails
      return {
        title: this.extractTitleFromUrl(url),
        description: '',
        tags: ['saved-content'],
        thumbnail: ''
      };
    }
  }

  async analyzeTikTokUrl(url) {
    console.log(`🎵 Analyzing TikTok URL: ${url}`);
    
    // Extract TikTok video ID and get metadata
    const videoId = this.extractTikTokId(url);
    
    // Try to get real TikTok metadata first
    let realMetadata = null;
    try {
      realMetadata = await this.fetchTikTokMetadata(url);
      console.log('📱 TikTok metadata fetched:', realMetadata ? 'SUCCESS' : 'FAILED');
    } catch (error) {
      console.warn('⚠️  TikTok metadata fetch failed:', error.message);
    }
    
    // If OpenAI is not available, use enhanced fallback
    if (!openai) {
      return this.getEnhancedTikTokFallback(url, realMetadata);
    }
    
    // Use OpenAI with real metadata if available
    const prompt = realMetadata ? `
    Analyze this TikTok video with the following metadata:
    Title: ${realMetadata.title || 'Unknown'}
    Description: ${realMetadata.description || 'No description'}
    Author: ${realMetadata.author || 'Unknown'}
    URL: ${url}
    
    Generate smart tags and analysis:
    1. A clean, engaging title (max 60 characters)
    2. 5-8 relevant search tags based on content
    3. A concise description highlighting key points
    
    Return as JSON: {"title": "...", "tags": ["tag1", "tag2"], "description": "..."}
    ` : `
    Analyze this TikTok URL: ${url}
    
    Based on TikTok content patterns and URL structure, generate:
    1. A descriptive title (max 50 characters)
    2. 5-7 relevant search tags
    3. A brief description
    
    Focus on common TikTok categories: cooking, dancing, comedy, tutorials, trends, etc.
    
    Return as JSON: {"title": "...", "tags": ["tag1", "tag2"], "description": "..."}
    `;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 250,
        temperature: 0.3
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      console.log('🤖 OpenAI analysis completed for TikTok');
      
      return {
        title: analysis.title || realMetadata?.title || 'TikTok Video',
        description: analysis.description || realMetadata?.description || '',
        tags: analysis.tags || ['tiktok', 'video', 'viral'],
        thumbnail: realMetadata?.thumbnail || this.generateTikTokThumbnail(url)
      };
    } catch (error) {
      console.error('❌ OpenAI analysis failed for TikTok:', error);
      return this.getEnhancedTikTokFallback(url, realMetadata);
    }
  }

  async analyzeScreenshot(imageUrl) {
    // If OpenAI is not available, use fallback analysis
    if (!openai) {
      return this.getFallbackAnalysis(imageUrl, 'screenshot');
    }
    
    // For screenshots, we'd typically use OCR + image analysis
    // For MVP, we'll simulate this with URL-based analysis
    
    const prompt = `
    Analyze this screenshot URL: ${imageUrl}
    
    Generate relevant tags for a screenshot that might contain:
    - Text content (receipts, messages, notes)
    - Social media posts
    - Memes or funny content
    - Product pages or shopping
    - Important information
    
    Return as JSON: {"title": "...", "tags": ["tag1", "tag2"], "description": "..."}
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.3
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    
    return {
      title: analysis.title || 'Screenshot',
      description: analysis.description || '',
      tags: analysis.tags || ['screenshot', 'image'],
      thumbnail: imageUrl
    };
  }

  async analyzeGenericUrl(url) {
    const prompt = `
    Analyze this URL and generate relevant tags: ${url}
    
    Based on the domain and URL structure, generate:
    1. A descriptive title
    2. 3-5 relevant search tags
    
    Return as JSON: {"title": "...", "tags": ["tag1", "tag2"], "description": "..."}
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.3
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    
    return {
      title: analysis.title || this.extractTitleFromUrl(url),
      description: analysis.description || '',
      tags: analysis.tags || ['link'],
      thumbnail: ''
    };
  }

  extractTikTokId(url) {
    const match = url.match(/\/video\/(\d+)/);
    return match ? match[1] : null;
  }

  generateTikTokThumbnail(url) {
    // TikTok thumbnail URL pattern (this is a simplified version)
    const videoId = this.extractTikTokId(url);
    return videoId ? `https://p16-sign-va.tiktokcdn.com/obj/tos-maliva-p-0068/${videoId}.jpeg` : '';
  }

  extractTitleFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      return `Content from ${domain}`;
    } catch {
      return 'Saved Content';
    }
  }

  getFallbackAnalysis(url, contentType) {
    // Simple fallback analysis when OpenAI is not available
    const domain = this.extractDomainFromUrl(url);
    
    if (contentType === 'tiktok') {
      return {
        title: 'TikTok Video',
        description: 'Saved video from TikTok',
        tags: ['tiktok', 'video', 'social-media'],
        thumbnail: ''
      };
    } else if (contentType === 'screenshot') {
      return {
        title: 'Screenshot',
        description: 'Saved screenshot image',
        tags: ['screenshot', 'image', 'saved'],
        thumbnail: url
      };
    } else {
      return {
        title: `Content from ${domain}`,
        description: 'Saved web content',
        tags: ['link', 'web', domain.toLowerCase()],
        thumbnail: ''
      };
    }
  }

  extractDomainFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }

  // Fetch real TikTok metadata using oembed API
  async fetchTikTokMetadata(url) {
    try {
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
      const response = await axios.get(oembedUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KovaBot/1.0)'
        }
      });
      
      if (response.data) {
        return {
          title: response.data.title,
          description: response.data.title, // TikTok oembed doesn't have separate description
          author: response.data.author_name,
          thumbnail: response.data.thumbnail_url,
          authorUrl: response.data.author_url
        };
      }
    } catch (error) {
      console.warn('TikTok oembed failed:', error.message);
    }
    return null;
  }

  // Enhanced fallback for TikTok when OpenAI is not available
  getEnhancedTikTokFallback(url, metadata) {
    if (metadata) {
      return {
        title: metadata.title || 'TikTok Video',
        description: `Video by ${metadata.author || 'Unknown'} on TikTok`,
        tags: this.generateSmartTags(metadata.title, 'tiktok'),
        thumbnail: metadata.thumbnail || this.generateTikTokThumbnail(url)
      };
    }
    
    // URL-based analysis for common TikTok patterns
    const urlPatterns = {
      dance: /dance|dancing|twerk|choreography|moves/i,
      cooking: /cook|recipe|food|eat|kitchen|chef/i,
      comedy: /funny|humor|laugh|joke|comedy|meme/i,
      tutorial: /tutorial|howto|diy|learn|tips|guide/i,
      fitness: /workout|fitness|gym|exercise|health/i,
      music: /music|song|singing|cover|performance/i
    };
    
    let category = 'viral';
    let tags = ['tiktok', 'video'];
    
    for (const [cat, pattern] of Object.entries(urlPatterns)) {
      if (pattern.test(url)) {
        category = cat;
        tags.push(cat);
        break;
      }
    }
    
    return {
      title: `${category.charAt(0).toUpperCase() + category.slice(1)} TikTok Video`,
      description: `Viral ${category} content from TikTok`,
      tags: [...tags, 'viral', 'social-media'],
      thumbnail: this.generateTikTokThumbnail(url)
    };
  }

  // Generate smart tags from title/content
  generateSmartTags(title, contentType) {
    const baseTags = [contentType];
    
    if (!title) return baseTags;
    
    const keywords = {
      cooking: ['recipe', 'food', 'cook', 'kitchen', 'chef', 'meal', 'ingredient'],
      fitness: ['workout', 'exercise', 'gym', 'health', 'fitness', 'training'],
      tutorial: ['how', 'diy', 'tutorial', 'guide', 'learn', 'tip', 'hack'],
      comedy: ['funny', 'laugh', 'joke', 'humor', 'comedy', 'meme'],
      dance: ['dance', 'dancing', 'moves', 'choreography', 'performance'],
      music: ['music', 'song', 'singing', 'cover', 'performance', 'audio'],
      viral: ['viral', 'trending', 'popular', 'hot', 'fire']
    };
    
    const titleLower = title.toLowerCase();
    
    for (const [category, words] of Object.entries(keywords)) {
      if (words.some(word => titleLower.includes(word))) {
        baseTags.push(category);
      }
    }
    
    return [...new Set(baseTags)]; // Remove duplicates
  }
}

module.exports = new AIService();
