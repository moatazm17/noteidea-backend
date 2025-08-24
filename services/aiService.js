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
            CREATE A SMART TITLE from this TikTok metadata:
            Title: "${realMetadata.title || 'Unknown'}"
            Author: ${realMetadata.author || 'Unknown'}
            URL: ${url}
            
            RULES:
            1. NEVER just say "TikTok Video" or "Fun Times" - that's LAZY
            2. If title mentions cooking/food → create cooking-focused title
            3. If it's a person's name → guess what they're doing based on their content style
            4. If unclear → be creative but specific
            5. Make it ENGAGING and CLICKABLE
            
            EXAMPLES:
            - "Celine Ko Lip Sync Performance" 
            - "Gordon Ramsay's Quick Cooking Tip"
            - "Dance Challenge Compilation"
            - "DIY Home Decor Hack"
            
            Generate:
            - Title: Creative, specific, engaging (max 60 chars)
            - Tags: Relevant to likely content (5-8 tags)
            - Description: What viewer would expect to see
            
            Return JSON: {"title": "...", "tags": ["tag1", "tag2"], "description": "..."}
            ` : `
            Create content from this TikTok URL: ${url}
            
            Extract creator from URL and make SMART guesses:
            - If @gordonramsay → cooking content
            - If @dance* → dance content  
            - If @comedy* → funny content
            - If @beauty* → makeup/style
            
            Be CREATIVE but LOGICAL. No generic "TikTok Video" bullshit.
            
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
            // Extract creator name from URL
            const creatorMatch = url.match(/@([^\/]+)/);
            const creator = creatorMatch ? creatorMatch[1] : null;
            
            if (metadata && metadata.title) {
              // Use metadata title but make it smarter
              const title = this.generateSmartTitleFromMetadata(metadata.title, creator);
              return {
                title,
                description: this.generateSmartDescription(title, creator),
                tags: this.generateSmartTags(metadata.title, 'tiktok'),
                thumbnail: metadata.thumbnail || this.generateTikTokThumbnail(url)
              };
            }
            
            // Creator-based smart analysis
            if (creator) {
              const creatorAnalysis = this.analyzeCreatorFromUsername(creator);
              return {
                title: `${creatorAnalysis.name} ${creatorAnalysis.contentType}`,
                description: `${creatorAnalysis.description} Check out this ${creatorAnalysis.contentType.toLowerCase()} from ${creatorAnalysis.name}!`,
                tags: [...creatorAnalysis.tags, 'tiktok', 'video'],
                thumbnail: this.generateTikTokThumbnail(url)
              };
            }
            
            // Generic but still better than "TikTok Video"
            return {
              title: 'Trending Social Media Content',
              description: 'Viral content from TikTok worth checking out',
              tags: ['tiktok', 'viral', 'trending', 'social-media'],
              thumbnail: this.generateTikTokThumbnail(url)
            };
          }

          generateSmartTitleFromMetadata(title, creator) {
            // Clean up lazy titles
            if (title.toLowerCase().includes('tiktok video') || title.toLowerCase().includes('fun times')) {
              if (creator) {
                return `${creator} Content Creation`;
              }
              return 'Creative Social Media Content';
            }
            
            // If title is just a name, make it better
            if (title.split(' ').length <= 2 && creator) {
              return `${title} Performance`;
            }
            
            return title;
          }

          generateSmartDescription(title, creator) {
            const creatorText = creator ? ` by ${creator}` : '';
            return `${title}${creatorText}. Engaging content worth saving for later reference.`;
          }

          analyzeCreatorFromUsername(username) {
            const lowerUsername = username.toLowerCase();
            
            // Chef/Cooking patterns
            if (lowerUsername.includes('chef') || lowerUsername.includes('cook') || lowerUsername.includes('recipe') || lowerUsername.includes('gordon')) {
              return {
                name: this.formatCreatorName(username),
                contentType: 'Cooking Tutorial',
                description: 'Culinary expertise and cooking tips.',
                tags: ['cooking', 'recipe', 'chef', 'food']
              };
            }
            
            // Dance patterns
            if (lowerUsername.includes('dance') || lowerUsername.includes('choreo') || lowerUsername.includes('moves')) {
              return {
                name: this.formatCreatorName(username),
                contentType: 'Dance Performance',
                description: 'Creative dance moves and choreography.',
                tags: ['dance', 'performance', 'choreography', 'music']
              };
            }
            
            // Beauty/Fashion patterns
            if (lowerUsername.includes('beauty') || lowerUsername.includes('makeup') || lowerUsername.includes('style')) {
              return {
                name: this.formatCreatorName(username),
                contentType: 'Beauty & Style',
                description: 'Beauty tips and style inspiration.',
                tags: ['beauty', 'makeup', 'style', 'fashion']
              };
            }
            
            // Fitness patterns
            if (lowerUsername.includes('fit') || lowerUsername.includes('gym') || lowerUsername.includes('workout')) {
              return {
                name: this.formatCreatorName(username),
                contentType: 'Fitness Content',
                description: 'Workout tips and fitness motivation.',
                tags: ['fitness', 'workout', 'health', 'motivation']
              };
            }
            
            // Comedy patterns
            if (lowerUsername.includes('comedy') || lowerUsername.includes('funny') || lowerUsername.includes('meme')) {
              return {
                name: this.formatCreatorName(username),
                contentType: 'Comedy Content',
                description: 'Entertaining and humorous content.',
                tags: ['comedy', 'funny', 'entertainment', 'humor']
              };
            }
            
            // Default for unknown creators
            return {
              name: this.formatCreatorName(username),
              contentType: 'Creative Content',
              description: 'Original creative content and entertainment.',
              tags: ['creative', 'entertainment', 'original']
            };
          }

          formatCreatorName(username) {
            // Capitalize first letter of each word and remove special chars
            return username
              .replace(/[^a-zA-Z0-9\s]/g, ' ')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ')
              .trim();
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
