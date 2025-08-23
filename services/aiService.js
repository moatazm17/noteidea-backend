const OpenAI = require('openai');
const axios = require('axios');

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

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
    // Extract TikTok video ID and get metadata
    const videoId = this.extractTikTokId(url);
    
    // If OpenAI is not available, use fallback analysis
    if (!openai) {
      return this.getFallbackAnalysis(url, 'tiktok');
    }
    
    // For MVP, we'll use the URL structure to extract basic info
    // In production, you'd use TikTok API or web scraping
    const prompt = `
    Analyze this TikTok URL and generate relevant tags: ${url}
    
    Based on the URL structure and common TikTok content patterns, generate:
    1. A descriptive title (max 50 characters)
    2. 5-7 relevant search tags
    3. A brief description
    
    Return as JSON: {"title": "...", "tags": ["tag1", "tag2"], "description": "..."}
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.3
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    
    return {
      title: analysis.title || 'TikTok Video',
      description: analysis.description || '',
      tags: analysis.tags || ['tiktok', 'video'],
      thumbnail: this.generateTikTokThumbnail(url)
    };
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
}

module.exports = new AIService();
