// Quick verification script to test if routes are accessible
import http from 'http';

const testRoute = (path, method = 'GET', body = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode, data: data });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

async function verifyRoutes() {
  console.log('🔍 Testing backend routes...\n');

  try {
    // Test health
    const health = await testRoute('/health');
    console.log(`✅ /health: ${health.status} - ${health.data}`);

    // Test auth health
    const authHealth = await testRoute('/api/auth/health');
    if (authHealth.status === 404) {
      console.log(`❌ /api/auth/health: 404 - Route not found!`);
      console.log(`   This means auth routes are NOT registered.`);
    } else {
      console.log(`✅ /api/auth/health: ${authHealth.status} - ${authHealth.data}`);
    }

    // Test signup (should return validation error, not 404)
    const signup = await testRoute('/api/auth/signup', 'POST', {});
    if (signup.status === 404) {
      console.log(`❌ /api/auth/signup: 404 - Route not found!`);
      console.log(`   Server needs to be restarted to register routes.`);
    } else {
      console.log(`✅ /api/auth/signup: ${signup.status} - ${signup.data.substring(0, 100)}...`);
    }

    // Test login (should return validation error, not 404)
    const login = await testRoute('/api/auth/login', 'POST', {});
    if (login.status === 404) {
      console.log(`❌ /api/auth/login: 404 - Route not found!`);
    } else {
      console.log(`✅ /api/auth/login: ${login.status} - ${login.data.substring(0, 100)}...`);
    }

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Cannot connect to server. Is the backend running on port 3001?');
      console.error('   Start the server with: cd backend && npm run dev');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

verifyRoutes();
