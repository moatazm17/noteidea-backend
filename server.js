const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for image uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// MongoDB connection - try multiple Railway variable names
const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL || process.env.MONGO_URL || 'mongodb://localhost:27017/kova';
mongoose.connect(mongoUri)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Kova API is running!' });
});

// Import routes (we'll create these next)
const contentRoutes = require('./routes/content');
app.use('/api', contentRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Kova Backend Server running on port ${PORT}`);
});
