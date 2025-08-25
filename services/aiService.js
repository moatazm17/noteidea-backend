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
  // Helper function to extract JSON from OpenAI responses
  extractJson(text) {
    if (!text) return null;
    let t = text.trim().replace(/^```(json)?/i, '').replace(/```$/i, '').trim();
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start === -1 || end === -1 || start >= end) return null;
    
    try {
      const jsonStr = t.substring(start, end + 1)
        .replace(/,\s*}/g, '}')  // Remove trailing commas
        .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
      return JSON.parse(jsonStr);
    } catch (e) {
      console.warn('⚠️ JSON parse failed:', e.message, 'Raw:', t.slice(0, 200));
      return null;
    }
  }

  async analyzeContent(url, contentType) {
    try {
      // Force data URLs through screenshot analyzer to avoid huge prompts/logs
      if (typeof url === 'string' && (url.startsWith('data:image/') || /\/api\/image\//.test(url))) {
        contentType = 'screenshot';
      }
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
            Extract USEFUL INFORMATION from this TikTok video transcript.
            Return ONLY valid JSON with this exact schema (no extra commentary):
            {
              "title": "string",
              "category": "cooking|travel|tutorial|review|fitness|other",
              "keyInfo": "string",
              "details": ["string"],
              "tags": ["string"],
              "recipeName": "string",
              "ingredients": ["string with measurements like '2 cups flour'"],
              "steps": ["string"],
              "timeMinutes": number,
              "servings": "string",
              "cost": "string",
              "places": ["string"],
              "budget": "string",
              "dates": "string",
              "materials": ["string"],
              "duration": "string",
              "difficulty": "easy|intermediate|advanced",
              "product": "string",
              "price": "string",
              "pros": ["string"],
              "cons": ["string"],
              "rating": "string",
              "whereToBuy": "string",
              "exercises": ["string"],
              "targetMuscles": ["string"],
              "equipment": ["string"]
            }

            Context:
            Title: "${realMetadata?.title || 'Unknown'}"
            Author: ${realMetadata?.author || 'Unknown'}
            Transcript: "${transcript}"

            Notes:
            - If not cooking, fill generic fields (title/category/keyInfo/details/tags) and leave recipe fields empty.
            - tags must be short, lowercase, searchable (e.g., "pasta", "red-sauce", "vegan").
            ` : realMetadata ? `
            Based on the metadata below, predict useful info. Return ONLY JSON with schema:
            {"title":"string","category":"string","keyInfo":"string","details":["string"],"tags":["string"]}
            Metadata Title: "${realMetadata.title || 'Unknown'}" Author: ${realMetadata.author || 'Unknown'}
            ` : `
            Analyze URL and return ONLY JSON: {"title":"string","category":"other","keyInfo":"string","details":["string"],"tags":["string"]}
            URL: ${url}
            `;



      const buildSummary = (analysis) => {
        // Cooking-specific pretty summary
        if ((analysis.category || '').toLowerCase() === 'cooking' || (analysis.ingredients && analysis.ingredients.length)) {
          const lines = [];
          const rn = analysis.recipeName || analysis.title || realMetadata?.title || 'Recipe';
          lines.push(`Recipe name: ${rn}`);
          if (analysis.ingredients?.length) {
            lines.push('Ingredients:');
            analysis.ingredients.slice(0, 20).forEach(i => lines.push(`- ${i}`));
          }
          if (analysis.steps?.length) {
            lines.push('Steps:');
            analysis.steps.slice(0, 12).forEach((s, idx) => lines.push(`${idx + 1}. ${s}`));
          }
          const extras = [];
          if (analysis.timeMinutes) extras.push(`Cooking time: ${analysis.timeMinutes} minutes`);
          if (analysis.cost) extras.push(`Cost: ${analysis.cost}`);
          if (extras.length) lines.push(extras.join(' | '));
          return lines.join('\n');
        }
        // Generic
        const lines = [];
        if (analysis.keyInfo) lines.push(analysis.keyInfo);
        if (Array.isArray(analysis.details) && analysis.details.length) {
          analysis.details.slice(0, 5).forEach(d => lines.push(`- ${d}`));
        }
        return lines.join('\n');
      };

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 400,
          temperature: 0.2,
          response_format: { type: "json_object" }
        });

        const raw = response.choices?.[0]?.message?.content || '';
        const analysis = this.extractJson(raw) || {};
        if (!analysis || Object.keys(analysis).length === 0) {
          console.warn('⚠️ OpenAI returned non-JSON or empty analysis. Raw:', raw.slice(0, 500));
        }

        // Enrich tags (merge with ingredients keywords)
        const extraTags = [];
        if (Array.isArray(analysis.ingredients)) {
          analysis.ingredients.slice(0, 5).forEach(i => {
            const k = String(i).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)[0];
            if (k && k.length > 2) extraTags.push(k);
          });
        }
        if (analysis.timeMinutes) extraTags.push('time-'+String(analysis.timeMinutes));
        const tags = Array.from(new Set([...(analysis.tags||[]), ...extraTags])).slice(0, 10);

        const prettySummary = buildSummary(analysis);

        // SORTD-STYLE STRUCTURED EXTRACTION
        const structuredData = this.extractStructuredData(analysis, analysis.category || 'other');
        const insights = this.generateInsights(analysis, analysis.category || 'other', transcript);
        const displaySummary = this.createDisplaySummary(analysis, analysis.category || 'other', structuredData);

        console.log('🤖 OpenAI analysis completed for TikTok');
        
        return {
          title: analysis.title || analysis.recipeName || realMetadata?.title || 'TikTok Video',
          description: prettySummary || analysis.keyInfo || analysis.description || 'Useful information extracted',
          tags,
          thumbnail: realMetadata?.thumbnail || this.generateTikTokThumbnail(url),
          category: analysis.category || 'other',
          details: analysis.details || [],
          keyInfo: analysis.keyInfo || '',
          // NEW SORTD-STYLE FIELDS
          structuredData,
          insights,
          displaySummary
        };
      } catch (error) {
        console.error('❌ OpenAI analysis failed for TikTok:', error);
        return this.getEnhancedTikTokFallback(url, realMetadata);
      }
  }

  async analyzeScreenshot(imageUrl) {
    console.log('📸 Analyzing screenshot: data:image/*;base64,[truncated]');
    
    // If OpenAI is not available, use fallback analysis
    if (!openai) {
      console.log('⚠️ OpenAI not available, using fallback');
      return this.getFallbackAnalysis(imageUrl, 'screenshot');
    }
    
    // Ensure we have a data URL for the model. If we received an HTTP URL, download and convert.
    if (typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
      try {
        const resp = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 20000 });
        const mimeType = resp.headers['content-type'] || 'image/jpeg';
        const base64 = Buffer.from(resp.data).toString('base64');
        imageUrl = `data:${mimeType};base64,${base64}`;
      } catch (err) {
        console.error('❌ Failed to fetch image for OCR:', err.message || err);
        return this.getFallbackAnalysis(imageUrl, 'screenshot');
      }
    } else if (!imageUrl.startsWith('data:image/')) {
      console.error('❌ Invalid image format - must be data URL or HTTP image');
      return this.getFallbackAnalysis(imageUrl, 'screenshot');
    }
    
    // Check if it's a supported format
    const supportedFormats = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
    const formatMatch = imageUrl.match(/data:image\/([^;]+)/);
    const format = formatMatch ? formatMatch[1].toLowerCase() : 'unknown';
    
    // Estimate base64 size (rough check)
    const base64Data = imageUrl.split(',')[1];
    const sizeInBytes = (base64Data.length * 3) / 4;
    const sizeInMB = sizeInBytes / (1024 * 1024);
    
    console.log(`📊 Image validation: format=${format}, size=${sizeInMB.toFixed(2)}MB`);
    
    if (!supportedFormats.includes(format)) {
      console.warn(`⚠️ Unsupported image format: ${format}, proceeding anyway`);
    }
    
    if (sizeInMB > 20) {
      console.warn(`⚠️ Large image detected: ${sizeInMB.toFixed(2)}MB - may cause issues`);
    }
    
    console.log('🤖 Starting GPT-4o Vision API call...');
    
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
      console.log('📡 Making OpenAI API request with GPT-4o...');
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OpenAI API timeout after 60 seconds')), 60000);
      });
      
      const apiPromise = openai.chat.completions.create({
        model: "gpt-4o",
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
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const response = await Promise.race([apiPromise, timeoutPromise]);
      
      console.log('✅ OpenAI API response received');
      console.log('🔍 Parsing JSON response...');
      
      const analysis = this.extractJson(response.choices[0].message.content);
      console.log('🤖 GPT-4 Vision analysis completed for screenshot');
      
      return {
        title: analysis.title || 'Screenshot',
        description: analysis.keyInfo || analysis.description || 'Information extracted from screenshot',
        tags: analysis.tags || ['screenshot', 'image'],
        // Prefer http-served image if available in URL (not data URL)
        thumbnail: imageUrl.startsWith('http') ? imageUrl : '',
        category: analysis.category || 'other',
        details: analysis.details || [],
        keyInfo: analysis.keyInfo || ''
      };
    } catch (error) {
      console.error('❌ GPT-4 Vision analysis failed:', error);
      
      // Better error handling with specific error messages
      let errorReason = 'Unknown error';
      if (error.code === 'image_parse_error') {
        errorReason = 'Image format not supported or corrupted';
      } else if (error.status === 400) {
        errorReason = 'Invalid image data';
      } else if (error.status === 413) {
        errorReason = 'Image too large';
      } else if (error.message?.includes('unsupported')) {
        errorReason = 'Unsupported image format';
      }
      
      console.log(`🔧 Using fallback analysis due to: ${errorReason}`);
      
      // Enhanced fallback for images
      return {
        title: 'Screenshot',
        description: `Screenshot saved (OCR failed: ${errorReason})`,
        tags: ['screenshot', 'image', 'saved'],
        thumbnail: imageUrl.startsWith('http') ? imageUrl : '',
        category: 'other',
        details: [`OCR analysis failed: ${errorReason}`, 'Try with a smaller, clearer image'],
        keyInfo: 'Screenshot saved successfully'
      };
    }
  }

  async analyzeGenericUrl(url) {
    // Never include full data URLs in the prompt
    const safeUrl = (typeof url === 'string' && url.startsWith('data:image/')) ? 'data:image/*;base64,[truncated]' : url;
    const prompt = `
    Analyze this URL and generate relevant tags: ${safeUrl}
    
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

    const raw = response.choices?.[0]?.message?.content || '{}';
    const analysis = this.extractJson(raw) || {};
    
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

          // SORTD-STYLE STRUCTURED DATA EXTRACTION
          extractStructuredData(analysis, category) {
            const structured = {};
            
            // Emoji mapping for ingredients
            const ingredientEmojis = {
              'potato': '🥔', 'tomato': '🍅', 'onion': '🧅', 'garlic': '🧄',
              'lemon': '🍋', 'olive oil': '🫒', 'salt': '🧂', 'pepper': '🌶️',
              'cheese': '🧀', 'milk': '🥛', 'egg': '🥚', 'flour': '🌾',
              'pasta': '🍝', 'rice': '🍚', 'bread': '🍞', 'butter': '🧈',
              'chicken': '🍗', 'beef': '🥩', 'fish': '🐟', 'shrimp': '🦐',
              'carrot': '🥕', 'broccoli': '🥦', 'corn': '🌽', 'cucumber': '🥒',
              'apple': '🍎', 'banana': '🍌', 'orange': '🍊', 'strawberry': '🍓',
              'wine': '🍷', 'water': '💧', 'coffee': '☕', 'tea': '🍵',
              'sugar': '🍯', 'chocolate': '🍫', 'cream': '🥛', 'yogurt': '🥛',
              'herbs': '🌿', 'basil': '🌿', 'parsley': '🌿', 'dill': '🌿',
              'oil': '🫒', 'vinegar': '🍾', 'sauce': '🥫', 'mayo': '🥫'
            };

            // Step action icons
            const actionIcons = {
              'preheat': '🔥', 'heat': '🔥', 'bake': '🔥', 'cook': '🔥',
              'mix': '🥄', 'stir': '🥄', 'whisk': '🥄', 'combine': '🥄',
              'chop': '🔪', 'cut': '🔪', 'slice': '🔪', 'dice': '🔪',
              'wait': '⏰', 'rest': '⏰', 'cool': '❄️', 'chill': '❄️',
              'serve': '🍽️', 'plate': '🍽️', 'garnish': '🌿', 'season': '🧂',
              'pour': '🫗', 'drain': '💧', 'boil': '💦', 'simmer': '♨️'
            };

            if (category === 'cooking' && analysis.ingredients?.length) {
              // Clean ingredients with emojis
              structured.ingredients = (analysis.ingredients || []).map(ing => {
                const cleaned = String(ing).trim();
                let emoji = '';
                for (const [key, icon] of Object.entries(ingredientEmojis)) {
                  if (cleaned.toLowerCase().includes(key)) {
                    emoji = icon;
                    break;
                  }
                }
                return { text: cleaned, emoji: emoji || '🥘' };
              });

              // Steps with action icons
              structured.steps = (analysis.steps || []).map((step, idx) => {
                const cleaned = String(step).trim();
                let icon = '👉';
                for (const [key, emoji] of Object.entries(actionIcons)) {
                  if (cleaned.toLowerCase().includes(key)) {
                    icon = emoji;
                    break;
                  }
                }
                return { text: cleaned, icon, number: idx + 1 };
              });

              structured.time = analysis.timeMinutes ? `${analysis.timeMinutes} min` : null;
              structured.servings = analysis.servings || null;
            }

            else if (category === 'travel') {
              structured.places = (analysis.places || analysis.details || []).slice(0, 5).map(p => ({
                text: String(p),
                emoji: '📍'
              }));
              structured.budget = analysis.budget || analysis.price || null;
              structured.dates = analysis.dates || null;
              structured.transportation = analysis.transportation || [];
            }

            else if (category === 'tutorial' || category === 'diy') {
              structured.materials = (analysis.materials || analysis.details || []).slice(0, 10).map(m => ({
                text: String(m),
                emoji: '🛠️'
              }));
              structured.steps = (analysis.steps || []).map((s, idx) => ({
                text: String(s),
                icon: '👉',
                number: idx + 1
              }));
              structured.duration = analysis.duration || analysis.timeMinutes || null;
              structured.difficulty = analysis.difficulty || 'Intermediate';
            }

            else if (category === 'review' || category === 'product') {
              structured.product = analysis.product || analysis.title;
              structured.price = analysis.price || null;
              structured.pros = (analysis.pros || []).map(p => ({
                text: String(p),
                emoji: '✅'
              }));
              structured.cons = (analysis.cons || []).map(c => ({
                text: String(c),
                emoji: '❌'
              }));
              structured.rating = analysis.rating || null;
              structured.whereToBuy = analysis.whereToBuy || analysis.store || null;
            }

            else if (category === 'fitness' || category === 'workout') {
              structured.exercises = (analysis.exercises || analysis.movements || analysis.details || []).map(e => ({
                text: String(e),
                emoji: '💪'
              }));
              structured.duration = analysis.duration || (analysis.timeMinutes ? `${analysis.timeMinutes} min` : '30 min');
              structured.targetMuscles = analysis.targetMuscles || [];
              structured.equipment = analysis.equipment || [];
            }

            else {
              // Generic structured format
              structured.keyPoints = (analysis.details || []).slice(0, 5).map(d => ({
                text: String(d),
                emoji: '📌'
              }));
              structured.links = analysis.links || [];
            }

            return structured;
          }

          // Generate smart insights like Sortd
          generateInsights(analysis, category, transcript) {
            const insights = [];

            if (category === 'cooking') {
              if (analysis.ingredients?.some(i => String(i).toLowerCase().includes('fresh'))) {
                insights.push({
                  icon: '🌿',
                  title: 'Freshness Matters',
                  text: 'Fresh ingredients make a big difference in this recipe'
                });
              }
              if (analysis.steps?.some(s => String(s).toLowerCase().includes('crispy') || String(s).toLowerCase().includes('texture'))) {
                insights.push({
                  icon: '✨',
                  title: 'Texture is Key',
                  text: 'Pay attention to cooking times for the perfect texture'
                });
              }
              if (analysis.timeMinutes && analysis.timeMinutes <= 20) {
                insights.push({
                  icon: '⚡',
                  title: 'Quick & Easy',
                  text: `Ready in just ${analysis.timeMinutes} minutes`
                });
              }
              if (!insights.length) {
                insights.push({
                  icon: '👨‍🍳',
                  title: 'Cooking Tip',
                  text: 'Take your time with each step for best results'
                });
              }
            }

            else if (category === 'travel') {
              insights.push({
                icon: '💡',
                title: 'Best Time to Visit',
                text: 'Check seasonal weather and local events'
              });
              if (analysis.budget || analysis.price) {
                insights.push({
                  icon: '💰',
                  title: 'Budget Tip',
                  text: 'Book early for better deals on flights and hotels'
                });
              }
              insights.push({
                icon: '📸',
                title: 'Don\'t Miss',
                text: 'Research top photo spots and hidden gems'
              });
            }

            else if (category === 'tutorial' || category === 'diy') {
              insights.push({
                icon: '🎯',
                title: 'Pro Tip',
                text: 'Take your time with each step for best results'
              });
              if (analysis.materials?.length > 5) {
                insights.push({
                  icon: '📝',
                  title: 'Preparation',
                  text: 'Gather all materials before starting'
                });
              }
            }

            else if (category === 'fitness' || category === 'workout') {
              insights.push({
                icon: '💪',
                title: 'Form First',
                text: 'Focus on proper form over speed or reps'
              });
              insights.push({
                icon: '🔥',
                title: 'Warm Up',
                text: 'Always warm up before starting'
              });
            }

            else {
              insights.push({
                icon: '💡',
                title: 'Key Takeaway',
                text: 'Save this for future reference'
              });
            }

            // Limit to 3 insights
            return insights.slice(0, 3);
          }

          // Create display summary for cards
          createDisplaySummary(analysis, category, structured) {
            if (category === 'cooking') {
              const parts = [];
              if (structured.time) parts.push(structured.time);
              if (structured.ingredients?.length) parts.push(`${structured.ingredients.length} ingredients`);
              if (structured.servings) parts.push(`${structured.servings} servings`);
              return parts.join(' • ') || 'Recipe saved';
            }
            
            else if (category === 'travel') {
              const parts = [];
              if (structured.places?.length) parts.push(structured.places[0].text);
              if (structured.budget) parts.push(structured.budget);
              if (structured.dates) parts.push(structured.dates);
              return parts.join(' • ') || 'Travel content saved';
            }

            else if (category === 'tutorial' || category === 'diy') {
              const parts = [];
              if (structured.duration) parts.push(structured.duration);
              if (structured.materials?.length) parts.push(`${structured.materials.length} materials`);
              parts.push(structured.difficulty || 'Tutorial');
              return parts.join(' • ');
            }

            else if (category === 'fitness' || category === 'workout') {
              const parts = [];
              if (structured.duration) parts.push(structured.duration);
              if (structured.exercises?.length) parts.push(`${structured.exercises.length} exercises`);
              return parts.join(' • ') || 'Workout saved';
            }

            return analysis.keyInfo || 'Content saved';
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
