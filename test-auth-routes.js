// Quick test script to verify auth routes are accessible
import fetch from 'node-fetch';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function testRoutes() {
  console.log('Testing auth routes...\n');

  // Test health endpoint
  try {
    const healthRes = await fetch(`${BACKEND_URL}/health`);
    console.log('✅ Health endpoint:', healthRes.status, await healthRes.text());
  } catch (error) {
    console.error('❌ Health endpoint failed:', error.message);
  }

  // Test auth health endpoint
  try {
    const authHealthRes = await fetch(`${BACKEND_URL}/api/auth/health`);
    console.log('✅ Auth health endpoint:', authHealthRes.status, await authHealthRes.text());
  } catch (error) {
    console.error('❌ Auth health endpoint failed:', error.message);
  }

  // Test signup endpoint (should return validation error, not 404)
  try {
    const signupRes = await fetch(`${BACKEND_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const signupData = await signupRes.json();
    if (signupRes.status === 404) {
      console.error('❌ Signup endpoint: 404 Not Found - Route not registered!');
    } else {
      console.log('✅ Signup endpoint:', signupRes.status, signupData);
    }
  } catch (error) {
    console.error('❌ Signup endpoint failed:', error.message);
  }

  // Test login endpoint (should return validation error, not 404)
  try {
    const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const loginData = await loginRes.json();
    if (loginRes.status === 404) {
      console.error('❌ Login endpoint: 404 Not Found - Route not registered!');
    } else {
      console.log('✅ Login endpoint:', loginRes.status, loginData);
    }
  } catch (error) {
    console.error('❌ Login endpoint failed:', error.message);
  }
}

testRoutes().catch(console.error);
