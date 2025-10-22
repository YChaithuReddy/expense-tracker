/**
 * UptimeRobot API Integration (Optional)
 *
 * This script allows you to manage UptimeRobot monitors programmatically.
 * You need to set up UptimeRobot account first and get your API key.
 *
 * Get API Key:
 * 1. Login to UptimeRobot
 * 2. My Settings → API Settings
 * 3. Copy "Main API Key"
 * 4. Add to .env file: UPTIMEROBOT_API_KEY=your_api_key
 *
 * Usage:
 * - node uptimerobot-api.js list           # List all monitors
 * - node uptimerobot-api.js create         # Create monitor for backend
 * - node uptimerobot-api.js status         # Check status of all monitors
 */

const https = require('https');
const querystring = require('querystring');

// Load API key from environment variable
require('dotenv').config();
const API_KEY = process.env.UPTIMEROBOT_API_KEY;

const UPTIMEROBOT_API = 'api.uptimerobot.com';
const BACKEND_URL = 'https://expense-tracker-production-b501.up.railway.app/api/health';
const FRONTEND_URL = 'https://expense-tracker-delta-ashy.vercel.app';

/**
 * Make API request to UptimeRobot
 */
function makeRequest(endpoint, data) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      api_key: API_KEY,
      format: 'json',
      ...data
    });

    const options = {
      hostname: UPTIMEROBOT_API,
      path: `/v2/${endpoint}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          if (json.stat === 'ok') {
            resolve(json);
          } else {
            reject(new Error(json.error?.message || 'API request failed'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * List all monitors
 */
async function listMonitors() {
  try {
    const result = await makeRequest('getMonitors', {});

    if (result.monitors.length === 0) {
      console.log('No monitors found.');
      return;
    }

    console.log('\n📊 Your UptimeRobot Monitors:\n');
    result.monitors.forEach((monitor, index) => {
      const status = monitor.status === 2 ? '✅ UP' : '❌ DOWN';
      const uptime = monitor.custom_uptime_ratio || 'N/A';

      console.log(`${index + 1}. ${monitor.friendly_name}`);
      console.log(`   Status: ${status}`);
      console.log(`   URL: ${monitor.url}`);
      console.log(`   Uptime (30d): ${uptime}%`);
      console.log(`   ID: ${monitor.id}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Error listing monitors:', error.message);
  }
}

/**
 * Create backend health monitor
 */
async function createBackendMonitor() {
  try {
    console.log('Creating backend monitor...');

    const result = await makeRequest('newMonitor', {
      friendly_name: 'Expense Tracker Backend',
      url: BACKEND_URL,
      type: 1, // HTTP(s)
      interval: 300, // 5 minutes
      timeout: 30,
      alert_contacts: '', // Will use default alert contacts from account
    });

    console.log('✅ Backend monitor created successfully!');
    console.log('Monitor ID:', result.monitor.id);
    console.log('\nView at: https://uptimerobot.com/dashboard');
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Monitor already exists for this URL');
    } else {
      console.error('❌ Error creating monitor:', error.message);
    }
  }
}

/**
 * Create frontend monitor
 */
async function createFrontendMonitor() {
  try {
    console.log('Creating frontend monitor...');

    const result = await makeRequest('newMonitor', {
      friendly_name: 'Expense Tracker Frontend',
      url: FRONTEND_URL,
      type: 1, // HTTP(s)
      interval: 300, // 5 minutes
      timeout: 30,
      alert_contacts: '',
    });

    console.log('✅ Frontend monitor created successfully!');
    console.log('Monitor ID:', result.monitor.id);
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Monitor already exists for this URL');
    } else {
      console.error('❌ Error creating monitor:', error.message);
    }
  }
}

/**
 * Get status of all monitors
 */
async function getStatus() {
  try {
    const result = await makeRequest('getMonitors', {
      custom_uptime_ratios: '1-7-30'
    });

    if (result.monitors.length === 0) {
      console.log('No monitors configured yet.');
      return;
    }

    console.log('\n🔍 Monitor Status Report:\n');

    result.monitors.forEach((monitor) => {
      const statusEmoji = monitor.status === 2 ? '✅' : '❌';
      const statusText = monitor.status === 2 ? 'UP' : 'DOWN';

      console.log(`${statusEmoji} ${monitor.friendly_name}: ${statusText}`);
      console.log(`   URL: ${monitor.url}`);
      console.log(`   Uptime: 24h: ${monitor.custom_uptime_ratio?.split('-')[0] || 'N/A'}% | 7d: ${monitor.custom_uptime_ratio?.split('-')[1] || 'N/A'}% | 30d: ${monitor.custom_uptime_ratio?.split('-')[2] || 'N/A'}%`);

      if (monitor.status !== 2) {
        console.log(`   ⚠️  Last Down: ${new Date(monitor.last_down_time * 1000).toLocaleString()}`);
      }

      console.log('');
    });
  } catch (error) {
    console.error('❌ Error getting status:', error.message);
  }
}

/**
 * Delete monitor by ID
 */
async function deleteMonitor(monitorId) {
  try {
    await makeRequest('deleteMonitor', {
      id: monitorId
    });
    console.log('✅ Monitor deleted successfully');
  } catch (error) {
    console.error('❌ Error deleting monitor:', error.message);
  }
}

/**
 * Main function
 */
async function main() {
  const command = process.argv[2];

  if (!API_KEY) {
    console.log('❌ Error: UPTIMEROBOT_API_KEY not set in .env file');
    console.log('\nTo use this script:');
    console.log('1. Sign up at: https://uptimerobot.com');
    console.log('2. Get API key: My Settings → API Settings');
    console.log('3. Add to .env: UPTIMEROBOT_API_KEY=your_api_key');
    console.log('\nFor manual setup guide, see: SETUP_UPTIMEROBOT.md');
    process.exit(1);
  }

  switch (command) {
    case 'list':
      await listMonitors();
      break;

    case 'create':
      console.log('Creating monitors...\n');
      await createBackendMonitor();
      await createFrontendMonitor();
      console.log('\n✅ All monitors created!');
      break;

    case 'create-backend':
      await createBackendMonitor();
      break;

    case 'create-frontend':
      await createFrontendMonitor();
      break;

    case 'status':
      await getStatus();
      break;

    case 'delete':
      const monitorId = process.argv[3];
      if (!monitorId) {
        console.log('Usage: node uptimerobot-api.js delete <monitor_id>');
        console.log('Run "node uptimerobot-api.js list" to see monitor IDs');
        process.exit(1);
      }
      await deleteMonitor(monitorId);
      break;

    default:
      console.log('UptimeRobot API Manager\n');
      console.log('Available commands:');
      console.log('  list              - List all monitors');
      console.log('  create            - Create backend and frontend monitors');
      console.log('  create-backend    - Create backend monitor only');
      console.log('  create-frontend   - Create frontend monitor only');
      console.log('  status            - Show status of all monitors');
      console.log('  delete <id>       - Delete monitor by ID');
      console.log('\nExample:');
      console.log('  node uptimerobot-api.js status');
      console.log('\nNote: You must set UPTIMEROBOT_API_KEY in .env file first.');
      console.log('See SETUP_UPTIMEROBOT.md for manual setup guide.');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { listMonitors, createBackendMonitor, getStatus };
