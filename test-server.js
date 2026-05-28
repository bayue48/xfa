const { spawn } = require('child_process');
const axios = require('axios');

async function run() {
  console.log('Starting xfa Express server...');
  const serverProcess = spawn('node', ['src/server.js'], {
    env: { ...process.env, PORT: '4567' },
    shell: true
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[SERVER STDOUT] ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[SERVER STDERR] ${data.toString().trim()}`);
  });

  // Wait 1.5 seconds for server to start
  await new Promise(resolve => setTimeout(resolve, 1500));

  try {
    // 1. Test browser redirect (No bot user-agent)
    console.log('\n--- 1. Testing Normal Browser Request (should redirect to FB) ---');
    try {
      await axios.get('http://localhost:4567/share/v/1E6sX6iH2A', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        maxRedirects: 0 // Do not follow redirect so we can inspect the status
      });
    } catch (err) {
      if (err.response) {
        console.log(`Status Code: ${err.response.status}`);
        console.log(`Redirect Location: ${err.response.headers.location}`);
      } else {
        console.error('Request failed:', err.message);
      }
    }

    // 2. Test bot user-agent (Discordbot)
    console.log('\n--- 2. Testing Discordbot Request (should return HTML with meta tags) ---');
    const res = await axios.get('http://localhost:4567/share/v/1E6sX6iH2A', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)' }
    });
    console.log(`Status Code: ${res.status}`);
    console.log(`Content-Type: ${res.headers['content-type']}`);
    console.log('\nHTML Output Snippet (first 1200 chars):');
    console.log(res.data.substring(0, 1200));

    // 3. Test oEmbed endpoint
    console.log('\n--- 3. Testing oEmbed Endpoint ---');
    const oembedRes = await axios.get('http://localhost:4567/oembed?author=Laga%20Satriatama%20on%20Reels&author_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2Fv%2F1E6sX6iH2A');
    console.log(`Status Code: ${oembedRes.status}`);
    console.log('Response JSON:', oembedRes.data);

  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    console.log('\nStopping xfa Express server...');
    serverProcess.kill('SIGTERM');
    process.exit(0);
  }
}

run();