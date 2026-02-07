#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('[Test] Environment Variables:');
console.log('  VERTEX_AI_PROJECT_ID:', process.env.VERTEX_AI_PROJECT_ID);
console.log('  VERTEX_AI_LOCATION:', process.env.VERTEX_AI_LOCATION);
console.log('  GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);

// Setup credentials path
if (process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_APPLICATION_CREDENTIALS.startsWith('/')) {
  const credentialsPath = path.join(__dirname, process.env.GOOGLE_APPLICATION_CREDENTIALS);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
  console.log('  GOOGLE_APPLICATION_CREDENTIALS (resolved):', process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

console.log('\n[Test] Testing Vertex AI SDK...');

try {
  console.log('[Test] Importing VertexAI...');
  const { VertexAI } = await import('@google-cloud/vertexai');
  console.log('[Test] ✓ VertexAI imported successfully');
  
  console.log('[Test] Initializing VertexAI...');
  const vertexAI = new VertexAI({
    project: process.env.VERTEX_AI_PROJECT_ID,
    location: process.env.VERTEX_AI_LOCATION || 'asia-southeast1'
  });
  console.log('[Test] ✓ VertexAI initialized');
  
  console.log('[Test] Getting generative model...');
  const model = vertexAI.getGenerativeModel({
    model: 'gemini-2.0-flash'  // Latest model available in us-central1
  });
  console.log('[Test] ✓ Model obtained');
  
  console.log('\n[Test] Sending test request to Vertex AI...');
  const result = await model.generateContent('Hello, world!');
  console.log('[Test] ✓ Got response from Vertex AI');
  
  // Access the text from the response
  const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text 
    || result.response?.text?.() 
    || JSON.stringify(result.response).substring(0, 100);
  console.log('[Test] Response text length:', responseText?.length || 0);
  
  console.log('\n✅ All tests PASSED! Vertex AI is working correctly.');
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error('Full error:', error);
  process.exit(1);
}
