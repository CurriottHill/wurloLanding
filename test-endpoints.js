// Quick test to check if API endpoints are accessible
async function testEndpoints() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧪 Testing API endpoints...\n');
  
  // Test 1: Health check
  try {
    const response = await fetch(`${baseUrl}/api/spots-remaining`);
    console.log('✅ GET /api/spots-remaining:', response.status);
  } catch (err) {
    console.log('❌ GET /api/spots-remaining:', err.message);
  }
  
  // Test 2: Verify token endpoint
  try {
    const response = await fetch(`${baseUrl}/api/verify-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'test123' })
    });
    const data = await response.json();
    console.log('✅ POST /api/verify-token:', response.status, '-', data.message || 'OK');
  } catch (err) {
    console.log('❌ POST /api/verify-token:', err.message);
  }
  
  // Test 3: Set password endpoint
  try {
    const response = await fetch(`${baseUrl}/api/set-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'test123', password: 'test123' })
    });
    const data = await response.json();
    console.log('✅ POST /api/set-password:', response.status, '-', data.message || 'OK');
  } catch (err) {
    console.log('❌ POST /api/set-password:', err.message);
  }
  
  console.log('\n💡 If you see 404 errors, the server might not be running.');
  console.log('   Run: npm run dev');
}

testEndpoints();
