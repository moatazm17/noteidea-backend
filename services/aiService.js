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
    
                // First try to get video transcript for REAL analysis
            let transcript = null;
            try {
              transcript = await this.getVideoTranscript(url);
              console.log('📝 Transcript fetched:', transcript ? 'SUCCESS' : 'FAILED');
            } catch (error) {
              console.warn('⚠️  Transcript fetch failed:', error.message);
            }

            // Use OpenAI with REAL content analysis
            const prompt = transcript ? `
            Analyze this TikTok video with REAL content:
            
            Title: "${realMetadata?.title || 'Unknown'}"
            Author: ${realMetadata?.author || 'Unknown'}
            Video Transcript: "${transcript}"
            
            Based on the ACTUAL spoken content in the transcript, determine:
            1. What is the person actually saying/doing?
            2. Is this a lip-sync, dance, cooking, comedy, tutorial, or something else?
            3. What are the key topics mentioned in the speech?
            
            Generate accurate analysis:
            - Title: Describe what's ACTUALLY happening (max 60 chars)
            - Tags: Based on spoken content and actions (5-8 tags)
            - Description: Summarize the actual content (not assumptions)
            
            Return JSON: {"title": "...", "tags": ["tag1", "tag2"], "description": "..."}
            ` : realMetadata ? `
            Analyze this TikTok video with limited metadata:
            Title: "${realMetadata.title || 'Unknown'}"
            Author: ${realMetadata.author || 'Unknown'}
            
            Since we don't have transcript, analyze ONLY what we can infer from the title.
            Don't make assumptions about content type.
            Be conservative and generic if unclear.
            
            Return JSON: {"title": "...", "tags": ["tag1", "tag2"], "description": "..."}
            ` : `
            Analyze this TikTok URL: ${url}
            
            Without transcript or metadata, provide generic TikTok analysis:
            - Title: Generic but engaging
            - Tags: Basic TikTok-related tags
            - Description: Generic social media content description
            
            Return JSON: {"title": "...", "tags": ["tag1", "tag2"], "description": "..."}
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

            // Get video transcript from TikTok video
          async getVideoTranscript(url) {
            try {
              // Extract video ID from TikTok URL
              const videoId = this.extractTikTokId(url);
              if (!videoId) {
                throw new Error('Could not extract video ID from URL');
              }

              // Try multiple transcript APIs
              return await this.tryTranscriptAPIs(videoId, url);
            } catch (error) {
              console.error('❌ Transcript fetch failed:', error);
              return null;
            }
          }

          async tryTranscriptAPIs(videoId, originalUrl) {
            const apis = [
              // API 1: Direct TikTok transcript (if available)
              () => this.getTikTokDirectTranscript(videoId),
              // API 2: Generic video transcript service
              () => this.getGenericVideoTranscript(originalUrl),
              // API 3: Audio extraction + speech-to-text
              () => this.extractAudioAndTranscribe(originalUrl)
            ];

            for (const apiCall of apis) {
              try {
                const result = await apiCall();
                if (result) {
                  console.log('✅ Transcript API succeeded');
                  return result;
                }
              } catch (error) {
                console.warn('⚠️  Transcript API failed:', error.message);
                continue; // Try next API
              }
            }

            return null; // All APIs failed
          }

          async getTikTokDirectTranscript(videoId) {
            // For now, return null - we'd need a specific TikTok transcript API
            // This is where we'd integrate with services like Supadata or Masa
            console.log('🔍 Direct TikTok transcript not implemented yet');
            return null;
          }

          async getGenericVideoTranscript(url) {
            // Placeholder for generic video transcript services
            console.log('🔍 Generic video transcript not implemented yet');
            return null;
          }

          async extractAudioAndTranscribe(url) {
            // Placeholder for audio extraction + OpenAI Whisper
            console.log('🔍 Audio extraction + Whisper not implemented yet');
            return null;
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
