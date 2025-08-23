// Simple test script to verify API endpoints
const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';
const TEST_DEVICE_ID = 'test-device-123';

async function testAPI() {
  try {
    console.log('🧪 Testing NoteIdea API...\n');

    // Test 1: Save a TikTok video
    console.log('1. Testing TikTok save...');
    const saveResponse = await axios.post(`${BASE_URL}/save`, {
      deviceId: TEST_DEVICE_ID,
      url: 'https://tiktok.com/@chef/video/123456',
      contentType: 'tiktok'
    });
    console.log('✅ Save successful:', saveResponse.data.message);

    // Test 2: Save a screenshot
    console.log('\n2. Testing screenshot save...');
    const screenshotResponse = await axios.post(`${BASE_URL}/save`, {
      deviceId: TEST_DEVICE_ID,
      url: 'https://example.com/funny-meme.jpg',
      contentType: 'screenshot'
    });
    console.log('✅ Screenshot save successful:', screenshotResponse.data.message);

    // Test 3: Get all content
    console.log('\n3. Testing content retrieval...');
    const contentResponse = await axios.get(`${BASE_URL}/content/${TEST_DEVICE_ID}`);
    console.log('✅ Content retrieved:', contentResponse.data.data);

    // Test 4: Search content
    console.log('\n4. Testing search...');
    const searchResponse = await axios.get(`${BASE_URL}/search/${TEST_DEVICE_ID}?query=cooking`);
    console.log('✅ Search results:', searchResponse.data.total, 'items found');

    console.log('\n🎉 All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testAPI();
}

module.exports = testAPI;
