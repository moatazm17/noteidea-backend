require('dotenv').config();
const aiService = require('./services/aiService');

async function testWhisperTranscription() {
    console.log('🎤 Testing Whisper transcription...');
    
    const tiktokUrl = 'https://www.tiktok.com/@whatsbiancacooking/video/7377776307846892831?q=how%20to%20make%20pasta&t=1756103731341';
    
    try {
        console.log('\n🔍 Testing full TikTok analysis with Whisper...');
        const analysis = await aiService.analyzeContent(tiktokUrl, 'tiktok');
        
        console.log('\n📊 WHISPER + AI ANALYSIS RESULTS:');
        console.log('=' .repeat(60));
        console.log('🏷️  Title:', analysis.title);
        console.log('📝 Description:', analysis.description);
        console.log('🔗 Category:', analysis.category || 'N/A');
        console.log('💡 Key Info:', analysis.keyInfo || 'N/A');
        console.log('📋 Details:', analysis.details || 'N/A');
        console.log('🏷️  Tags:', analysis.tags);
        console.log('=' .repeat(60));
        
        console.log('\n✅ Whisper test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testWhisperTranscription();
