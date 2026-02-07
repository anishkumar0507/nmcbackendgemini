import mongoose from 'mongoose';

let isConnected = false;

/**
 * MongoDB connection singleton pattern
 * Loads MONGODB_URI from process.env
 */
export const connectDB = async () => {
  if (isConnected) {
    console.log('📦 MongoDB: Using existing connection');
    return;
  }

  try {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not set in environment variables');
    }

    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(mongoUri, options);
    isConnected = true;
    
    console.log('✅ MongoDB: Connected successfully');
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB: Disconnected');
      isConnected = false;
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    isConnected = false;
    throw error;
  }
};

export const disconnectDB = async () => {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('📦 MongoDB: Disconnected');
  }
};

export default { connectDB, disconnectDB };
