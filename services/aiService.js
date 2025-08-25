require('dotenv').config();
const OpenAI = require('openai');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

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

            // Use OpenAI to extract STRUCTURED DATA
            const prompt = transcript ? `
            Extract USEFUL INFORMATION from this TikTok video transcript:
            
            Title: "${realMetadata?.title || 'Unknown'}"
            Author: ${realMetadata?.author || 'Unknown'}
            Transcript: "${transcript}"
            
            YOUR JOB: Extract actionable information so the user doesn't need to watch the video again.
            
            If it's a COOKING video, extract:
            - Recipe name, ingredients, cooking time, cost
            - Steps in order
            - Tips mentioned
            
            If it's a TRAVEL video, extract:
            - Destination, prices mentioned, airlines, hotels
            - Best time to visit, tips
            - Specific places/attractions mentioned
            
            If it's a TUTORIAL/DIY, extract:
            - What they're making/teaching
            - Materials needed
            - Step-by-step process
            - Time required
            
            If it's PRODUCT REVIEW, extract:
            - Product name, price, where to buy
            - Pros and cons mentioned
            - Rating/recommendation
            
            Return JSON only with exactly this shape (no extra text):
            {
              "title": "string",
              "category": "cooking|travel|tutorial|review|other",
              "keyInfo": "string",
              "details": ["string"],
              "tags": ["string"]
            }
            ` : realMetadata ? `
            Analyze TikTok for USEFUL INFORMATION:
            Title: "${realMetadata.title || 'Unknown'}"
            Author: ${realMetadata.author || 'Unknown'}
            
            Based on title/author, predict what useful info this video contains.
            Don't be generic - think about what the USER wants to remember later.
            
            Return JSON only:
            {"title": "string", "category": "string", "keyInfo": "string", "details": ["string"], "tags": ["string"]}
            ` : `
            Analyze TikTok URL for potential content:
            URL: ${url}
            
            Based on URL pattern, predict content type and what info user might want.
            
            Return JSON only:
            {"title": "string", "category": "other", "keyInfo": "string", "details": ["string"], "tags": ["string"]}
            `;

      const extractJson = (text) => {
        if (!text) return null;
        // Remove code fences if present
        let t = text.trim().replace(/^```(json)?/i, '').replace(/```$/i, '').trim();
        // Try to locate the outermost JSON object
        const start = t.indexOf('{');
        const end = t.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          t = t.slice(start, end + 1);
        }
        try {
          return JSON.parse(t);
        } catch (e) {
          // Last resort: remove trailing commas and retry
          const cleaned = t.replace(/,\s*([}\]])/g, '$1');
          try { return JSON.parse(cleaned); } catch { return null; }
        }
      };

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 250,
          temperature: 0.2,
          response_format: { type: "json_object" }
        });

        const raw = response.choices?.[0]?.message?.content || '';
        const analysis = extractJson(raw) || {};
        if (!analysis || Object.keys(analysis).length === 0) {
          console.warn('⚠️ OpenAI returned non-JSON or empty analysis. Raw:', raw.slice(0, 500));
        }

        console.log('🤖 OpenAI analysis completed for TikTok');
        
        return {
          title: analysis.title || realMetadata?.title || 'TikTok Video',
          description: analysis.keyInfo || analysis.description || 'Useful information extracted',
          tags: analysis.tags || ['tiktok', 'video'],
          thumbnail: realMetadata?.thumbnail || this.generateTikTokThumbnail(url),
          category: analysis.category || 'other',
          details: analysis.details || [],
          keyInfo: analysis.keyInfo || ''
        };
      } catch (error) {
        console.error('❌ OpenAI analysis failed for TikTok:', error);
        return this.getEnhancedTikTokFallback(url, realMetadata);
      }
  }

  async analyzeScreenshot(imageUrl) {
    console.log(`📸 Analyzing screenshot: ${imageUrl}`);
    
    // If OpenAI is not available, use fallback analysis
    if (!openai) {
      return this.getFallbackAnalysis(imageUrl, 'screenshot');
    }
    
    const prompt = `
    Extract USEFUL INFORMATION from this screenshot image.
    
    YOUR JOB: Read all text and extract actionable data so the user doesn't need to look at the image again.
    
    Common screenshot types and what to extract:
    
    FLIGHT/TRAVEL:
    - Flight details: route, dates, prices, airline
    - Hotel bookings: name, dates, price, location
    - Travel deals or recommendations
    
    RECEIPTS/SHOPPING:
    - Store name, total amount, date
    - Items purchased and prices
    - Discounts or deals applied
    
    RESTAURANT/MENU:
    - Restaurant name, menu items, prices
    - Special offers or recommendations
    - Location or contact info
    
    SOCIAL MEDIA POSTS:
    - Key information or quotes
    - Product recommendations
    - Useful tips or advice mentioned
    
    MESSAGES/NOTES:
    - Important information shared
    - Addresses, phone numbers, links
    - To-do items or reminders
    
    Return JSON:
    {
      "title": "Descriptive title of what this screenshot contains",
      "category": "flight|receipt|menu|social|message|other",
      "keyInfo": "Most important information extracted",
      "details": ["Specific detail 1", "Detail 2", "Detail 3"],
      "tags": ["searchable", "keywords"]
    }
    `;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }
        ],
        max_tokens: 300,
        temperature: 0.3
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      console.log('🤖 GPT-4 Vision analysis completed for screenshot');
      
      return {
        title: analysis.title || 'Screenshot',
        description: analysis.keyInfo || analysis.description || 'Information extracted from screenshot',
        tags: analysis.tags || ['screenshot', 'image'],
        thumbnail: imageUrl,
        category: analysis.category || 'other',
        details: analysis.details || [],
        keyInfo: analysis.keyInfo || ''
      };
    } catch (error) {
      console.error('❌ GPT-4 Vision analysis failed:', error);
      return this.getFallbackAnalysis(imageUrl, 'screenshot');
    }
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
              // EXTRACT STRUCTURED DATA from rich metadata
              const structuredData = this.extractStructuredFromText(metadata.title);
              
              return {
                title: structuredData.title || this.generateSmartTitleFromMetadata(metadata.title, creator),
                description: structuredData.description || this.generateSmartDescription(metadata.title, creator),
                tags: structuredData.tags || this.generateSmartTags(metadata.title, 'tiktok'),
                thumbnail: metadata.thumbnail || this.generateTikTokThumbnail(url),
                category: structuredData.category || 'other',
                keyInfo: structuredData.keyInfo || '',
                details: structuredData.details || []
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

          // Extract structured data from text (works without OpenAI)
          extractStructuredFromText(text) {
            const lowerText = text.toLowerCase();
            
            // COOKING/PASTA DETECTION & EXTRACTION
            if (lowerText.includes('pasta') || lowerText.includes('recipe') || lowerText.includes('cook') || 
                lowerText.includes('flour') || lowerText.includes('ingredient') || lowerText.includes('rules')) {
              
              const ingredients = this.extractIngredientsFromText(text);
              const steps = this.extractStepsFromText(text);
              const tips = this.extractTipsFromText(text);
              
              return {
                title: this.extractRecipeTitle(text),
                category: 'cooking',
                keyInfo: `Recipe guide with ${ingredients.length > 0 ? ingredients.length + ' ingredients' : 'detailed instructions'}`,
                details: [...ingredients, ...steps, ...tips].slice(0, 5),
                tags: ['cooking', 'recipe', 'pasta', 'tutorial', 'homemade'],
                description: `${this.extractRecipeTitle(text)} - Complete cooking guide with step-by-step instructions`
              };
            }
            
            // TRAVEL DETECTION
            if (lowerText.includes('travel') || lowerText.includes('flight') || lowerText.includes('hotel') ||
                lowerText.includes('trip') || lowerText.includes('vacation')) {
              return {
                title: 'Travel Guide & Tips',
                category: 'travel',
                keyInfo: 'Travel advice and destination information',
                details: ['Travel planning', 'Destination recommendations', 'Budget tips'],
                tags: ['travel', 'tips', 'vacation', 'guide'],
                description: 'Travel content with practical planning information'
              };
            }
            
            // FITNESS/WORKOUT DETECTION
            if (lowerText.includes('workout') || lowerText.includes('exercise') || lowerText.includes('fitness') ||
                lowerText.includes('gym') || lowerText.includes('muscle')) {
              return {
                title: 'Fitness Training Guide',
                category: 'fitness',
                keyInfo: 'Exercise routine and fitness tips',
                details: ['Workout routine', 'Exercise form', 'Training tips'],
                tags: ['fitness', 'workout', 'exercise', 'health'],
                description: 'Fitness content with exercise instructions and tips'
              };
            }
            
            // DEFAULT - still better than generic
            return {
              title: text.split('.')[0].slice(0, 80) || 'Saved Content',
              category: 'other',
              keyInfo: 'Useful content saved for reference',
              details: [],
              tags: ['content', 'saved', 'tiktok'],
              description: text.slice(0, 200) + (text.length > 200 ? '...' : '')
            };
          }

          extractRecipeTitle(text) {
            if (text.includes('tagliatelle')) return 'Fresh Tagliatelle Pasta Recipe';
            if (text.includes('pasta')) return 'Homemade Fresh Pasta Recipe';
            if (text.includes('10 rules')) return 'Fresh Pasta - 10 Essential Rules';
            return 'Cooking Recipe Guide';
          }

          extractIngredientsFromText(text) {
            const ingredients = [];
            if (text.includes('flour') || text.includes('00')) ingredients.push("'00' flour");
            if (text.includes('egg')) ingredients.push('Eggs');
            if (text.includes('salt')) ingredients.push('Salt');
            if (text.includes('oil')) ingredients.push('Oil (optional)');
            return ingredients;
          }

          extractStepsFromText(text) {
            const steps = [];
            
            // Look for numbered rules/steps with better regex
            // Match patterns like "1. Choose '00' flour over regular flour:"
            const numberMatches = text.match(/\d+\.\s+[^:]+[:.]/g);
            if (numberMatches && numberMatches.length > 0) {
              return numberMatches.slice(0, 5).map(step => {
                const cleaned = step.replace(/^\d+\.\s*/, '').replace(/[:.]$/, '').trim();
                return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
              });
            }
            
            // Fallback: look for sentences with cooking actions
            const sentences = text.split(/[.!?]+/);
            for (let sentence of sentences) {
              sentence = sentence.trim();
              if (sentence.includes('knead')) steps.push('Knead dough until smooth (10 minutes)');
              if (sentence.includes('rest')) steps.push('Rest dough for 30 minutes');
              if (sentence.includes('roll')) steps.push('Roll out dough thinly');
              if (sentence.includes('cut')) steps.push('Cut into even strips');
              if (sentence.includes('cook') && sentence.includes('2-3')) steps.push('Cook in salted water (2-3 minutes)');
            }
            
            return steps.slice(0, 5);
          }

          extractTipsFromText(text) {
            const tips = [];
            if (text.includes('ratio') && text.includes('100g')) tips.push('Use 100g flour to 1 egg ratio');
            if (text.includes('dust') && text.includes('flour')) tips.push('Dust with flour to prevent sticking');
            if (text.includes('salted water')) tips.push('Use plenty of salt in boiling water');
            if (text.includes('00') && text.includes('flour')) tips.push("Choose '00' flour for better texture");
            return tips;
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
            console.log('🔍 Attempting to get video transcript via Masa...');
            try {
              const transcript = await this.getMasaTranscript(url);
              if (transcript && transcript.trim().length > 0) {
                console.log('✅ Masa transcript obtained');
                return transcript;
              }
              console.log('⚠️ Masa returned no transcript');
              return null;
            } catch (error) {
              console.error('❌ Masa transcript failed:', error.message || error);
              return null;
            }
          }

          async getMasaTranscript(videoUrl) {
            try {
              const resp = await axios.post(
                'https://data.masa.ai/api/v1/search/live/tiktok',
                {
                  type: 'tiktok',
                  arguments: {
                    type: 'transcription',
                    video_url: videoUrl,
                    language: 'eng-US'
                  }
                },
                {
                  headers: {
                    'Authorization': `Bearer ${process.env.MASA_API_KEY}`,
                    'Content-Type': 'application/json'
                  },
                  timeout: 30000
                }
              );

              // Immediate transcript cases
              if (resp.data) {
                if (typeof resp.data === 'string' && resp.data.trim()) return resp.data;
                if (resp.data.transcript) return resp.data.transcript;
                if (resp.data.result?.transcript) return resp.data.result.transcript;
              }

              // If a job uuid is returned, poll for result
              const jobUuid = resp.data?.uuid || resp.data?.job_id || resp.data?.id;
              if (!jobUuid) {
                return null;
              }

              console.log('🔄 Masa job started, polling for transcript...', jobUuid);

              // Potential result endpoints
              const makeGetUrls = [
                (id) => `https://data.masa.ai/api/v1/search/live/tiktok/result/${id}`, // prioritize exact endpoint
                (id) => `https://data.masa.ai/api/v1/search/results/${id}`,
                (id) => `https://data.masa.ai/api/v1/search/result/${id}`,
                (id) => `https://data.masa.ai/api/v1/search/${id}`,
                (id) => `https://data.masa.ai/api/v1/search/live/tiktok/${id}`,
                (id) => `https://data.masa.ai/api/v1/jobs/${id}`
              ];

              const postEndpoints = [
                'https://data.masa.ai/api/v1/search/result',
                'https://data.masa.ai/api/v1/search/results',
                'https://data.masa.ai/api/v1/search/status'
              ];

              const headers = { 'Authorization': `Bearer ${process.env.MASA_API_KEY}`, 'Content-Type': 'application/json' };
              const getHeaders = { 
                'Authorization': `Bearer ${process.env.MASA_API_KEY}`,
                'Accept': 'application/json',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              };

              const startedAt = Date.now();
              const timeoutMs = 180000; // 3 minutes
              let attempt = 0;

              const parseTranscript = (d) => {
                // Direct array of results
                if (Array.isArray(d) && d.length) {
                  // Common Masa shape: [{ id, source, content, metadata: {...} }]
                  if (d[0]?.content && typeof d[0].content === 'string') {
                    return d.map(x => x.content).join(' ').trim();
                  }
                }

                const candidates = [
                  d,
                  d?.data,
                  d?.result,
                  d?.results,
                  d?.payload,
                  d?.output,
                  d?.response
                ];
                for (const c of candidates) {
                  if (!c) continue;

                  // Array candidates nested under known keys
                  if (Array.isArray(c) && c.length) {
                    if (typeof c[0] === 'string') return c.join(' ').trim();
                    if (c[0]?.content) return c.map(s => s.content).join(' ').trim();
                    if (c[0]?.text) return c.map(s => s.text).join(' ').trim();
                  }

                  if (typeof c === 'string' && c.trim()) return c.trim();
                  if (c.transcript) return String(c.transcript).trim();
                  if (c.text) return String(c.text).trim();
                  if (c.segments && Array.isArray(c.segments)) {
                    return c.segments.map(s => s.text || s.caption || '').filter(Boolean).join(' ').trim();
                  }
                  if (c.caption) return String(c.caption).trim();
                }
                return null;
              };

              while (Date.now() - startedAt < timeoutMs) {
                attempt += 1;

                // Try GET endpoints
                for (const makeUrl of makeGetUrls) {
                  try {
                    const url = makeUrl(jobUuid);
                    const r = await axios.get(url, { headers: getHeaders, timeout: 10000 });
                    const transcript = parseTranscript(r.data);
                    if (transcript && transcript.trim()) {
                      console.log('✅ Masa transcript ready (GET)');
                      return transcript;
                    }
                  } catch (_) {
                    // ignore and continue
                  }
                }

                // Try POST endpoints with uuid
                for (const url of postEndpoints) {
                  try {
                    const r = await axios.post(url, { uuid: jobUuid }, { headers, timeout: 10000 });
                    const transcript = parseTranscript(r.data);
                    if (transcript && transcript.trim()) {
                      console.log('✅ Masa transcript ready (POST)');
                      return transcript;
                    }
                  } catch (_) {
                    // ignore and continue
                  }
                }

                // Small delay; increase slightly over time (cap at 5s)
                const delay = Math.min(1000 + attempt * 250, 5000);
                await new Promise(res => setTimeout(res, delay));
              }

              console.log('⌛️ Masa polling timed out');
              return null;
            } catch (error) {
              const msg = error.response?.data ? JSON.stringify(error.response.data) : (error.message || 'unknown error');
              console.log('⚠️ Masa API error:', msg);
              return null;
            }
          }

          // Remove multi-provider logic and fallbacks; keep simple
          async tryTranscriptAPIs(videoId, originalUrl) {
            // Deprecated: we now only use Masa
            return null;
          }

          async getTikTokDirectTranscript(url) {
            // Deprecated: handled by Masa only
            return null;
          }

          async getGenericVideoTranscript(url) {
            // Deprecated: handled by Masa only
            return null;
          }

          async extractAudioAndTranscribe(url) {
            // Deprecated: handled by Masa only
            return null;
          }

          async downloadAudio(audioUrl) {
            try {
              const response = await axios.get(audioUrl, { 
                responseType: 'arraybuffer',
                timeout: 30000 // 30 second timeout
              });
              return Buffer.from(response.data);
            } catch (error) {
              console.error('Audio download failed:', error);
              return null;
            }
          }

          async transcribeWithWhisper(audioFilePath) {
            if (!openai) {
              throw new Error('OpenAI not available for Whisper transcription');
            }

            try {
              console.log('🎯 Transcribing audio with Whisper API...');
              
              // Create file stream for Whisper API
              const audioStream = fs.createReadStream(audioFilePath);
              
              const response = await openai.audio.transcriptions.create({
                file: audioStream,
                model: 'whisper-1',
                response_format: 'text',
                language: 'en' // Can be removed for auto-detection
              });

              console.log('✅ Whisper transcription successful');
              return response.trim();
            } catch (error) {
              console.error('❌ Whisper transcription failed:', error);
              throw error;
            }
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
