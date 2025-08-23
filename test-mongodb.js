// Quick MongoDB connection test
const mongoose = require('mongoose');

// Replace this with your actual MongoDB connection string
const MONGODB_URI = 'mongodb+srv://your-username:your-password@your-cluster.mongodb.net/kova';

async function testConnection() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected successfully!');
    
    // Test creating a simple document
    const testSchema = new mongoose.Schema({ test: String });
    const TestModel = mongoose.model('Test', testSchema);
    
    const doc = new TestModel({ test: 'Kova backend works!' });
    await doc.save();
    console.log('✅ Test document created successfully!');
    
    await mongoose.connection.close();
    console.log('✅ Connection closed. MongoDB is ready for Kova!');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
  }
}

testConnection();
