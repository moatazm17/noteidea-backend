const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kova')
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
  console.log(`Server running on port ${PORT}`);
});
