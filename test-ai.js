#!/usr/bin/env node

// Quick test script to verify AI integration
require('dotenv').config();
const aiService = require('./services/aiService');

async function testAI() {
  console.log('🧪 Testing AI Service...\n');
  
  // Test URLs
  const testUrls = [
    {
      url: 'https://www.tiktok.com/@gordonramsayofficial/video/7234567890123456789',
      type: 'tiktok',
      description: 'TikTok cooking video'
    },
    {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      type: 'other',
      description: 'YouTube video'
    }
  ];
  
  for (const test of testUrls) {
    console.log(`📱 Testing ${test.description}: ${test.url}`);
    
    try {
      const result = await aiService.analyzeContent(test.url, test.type);
      
      console.log('✅ Analysis Result:');
      console.log(`   Title: ${result.title}`);
      console.log(`   Description: ${result.description}`);
      console.log(`   Tags: ${result.tags.join(', ')}`);
      console.log(`   Thumbnail: ${result.thumbnail || 'None'}`);
      console.log('');
      
    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
      console.log('');
    }
  }
  
  console.log('🏁 AI testing completed!');
}

// Run the test
if (require.main === module) {
  testAI().catch(console.error);
}

module.exports = { testAI };
