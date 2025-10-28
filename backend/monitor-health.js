/**
 * Backend Health Monitor
 * Run this script to check if your Railway backend is healthy
 *
 * Usage: node monitor-health.js
 */

const https = require('https');

const BACKEND_URL = 'https://expense-tracker-production-ycr.up.railway.app';
const HEALTH_ENDPOINT = '/api/health';

console.log('🔍 Checking backend health...\n');

const options = {
  hostname: BACKEND_URL.replace('https://', ''),
  path: HEALTH_ENDPOINT,
  method: 'GET',
  timeout: 10000
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`Status Code: ${res.statusCode}`);

    if (res.statusCode === 200) {
      console.log('✅ Backend is HEALTHY\n');

      try {
        const response = JSON.parse(data);
        console.log('Response:', JSON.stringify(response, null, 2));
        console.log('\n✅ All systems operational!');
      } catch (e) {
        console.log('⚠️  Backend responded but JSON parse failed');
        console.log('Raw response:', data);
      }
    } else {
      console.log('❌ Backend is UNHEALTHY\n');
      console.log('Response:', data);
      console.log('\n❌ Backend returned non-200 status');
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.log('❌ Backend is DOWN\n');
  console.log('Error:', error.message);
  console.log('\nPossible causes:');
  console.log('1. Railway backend is not running');
  console.log('2. Network connectivity issue');
  console.log('3. Railway domain has changed');
  console.log('\nCheck Railway dashboard: https://railway.app/dashboard');
  process.exit(1);
});

req.on('timeout', () => {
  console.log('❌ Backend TIMEOUT\n');
  console.log('Backend took too long to respond (>10 seconds)');
  console.log('\nPossible causes:');
  console.log('1. Backend is starting up (wait 30 seconds and try again)');
  console.log('2. High load or performance issues');
  console.log('3. MongoDB connection is slow');
  req.destroy();
  process.exit(1);
});

req.end();
