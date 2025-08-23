# NoteIdea Backend API

AI-powered content saving and search API for mobile app.

## Features

- 🎥 Save TikTok videos with AI analysis
- 📸 Save screenshots with smart tagging
- 🔍 Natural language search
- 🏷️ Automatic AI-generated tags
- 📱 Mobile-optimized API

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Create a `.env` file:
```
MONGODB_URI=your_mongodb_connection_string
OPENAI_API_KEY=your_openai_api_key
PORT=3000
```

### 3. Start Development Server
```bash
npm run dev
```

### 4. Test the API
```bash
node test.js
```

## API Endpoints

### Save Content
```
POST /api/save
{
  "deviceId": "user-device-id",
  "url": "https://tiktok.com/video/123",
  "contentType": "tiktok" | "screenshot"
}
```

### Get All Content
```
GET /api/content/:deviceId
```

### Search Content
```
GET /api/search/:deviceId?query=cooking
```

### Get Single Item
```
GET /api/content/:deviceId/:contentId
```

## Database Schema

```javascript
{
  deviceId: String,     // Anonymous device identifier
  url: String,          // Original content URL
  title: String,        // AI-generated title
  contentType: String,  // 'tiktok' | 'screenshot' | 'other'
  aiTags: [String],     // AI-generated search tags
  description: String,  // AI-generated description
  thumbnail: String,    // Thumbnail URL
  viewCount: Number,    // How many times viewed
  isFavorite: Boolean,  // User favorited
  savedAt: Date         // When saved
}
```

## Deployment

### Railway Deployment
1. Connect your GitHub repo to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

### Environment Variables for Production
- `MONGODB_URI`: Your MongoDB Atlas connection string
- `OPENAI_API_KEY`: Your OpenAI API key
- `PORT`: Will be set automatically by Railway

## Tech Stack

- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **AI**: OpenAI GPT-3.5 Turbo
- **Deployment**: Railway
- **CORS**: Enabled for mobile app

## Cost Estimation

For 1000 content saves per month:
- MongoDB Atlas: ~$0 (free tier)
- OpenAI API: ~$0.25 (very cheap for text analysis)
- Railway: ~$5/month (basic plan)

**Total: ~$5.25/month for 1000 active users**
