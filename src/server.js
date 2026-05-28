require('dotenv').config();
const express = require('express');
const { getEmbedInfo } = require('./utils/urlParser');
const { scrapeFacebookMetadata } = require('./services/scraper');

const app = express();
const PORT = process.env.PORT || 3000;

// Regular expression to identify Discord, Telegram, Slack, Twitter bots and standard crawler UAs
const BOT_UA_REGEX = /Discordbot|TelegramBot|Slackbot|Slack-ImgProxy|Slackbot-LinkExpanding|Twitterbot|facebookexternalhit|WhatsApp|Yahoo Link Preview|Pingdom|Googlebot|Google-Structured-Data-Testing-Tool/i;

// OEmbed endpoint to customize author and provider display in Discord
app.get('/oembed', (req, res) => {
  const authorName = req.query.author || 'Facebook User';
  const authorUrl = req.query.author_url || 'https://www.facebook.com';
  const providerName = req.query.provider || 'Facebook (fixed by xfa)';
  
  res.json({
    author_name: authorName,
    author_url: authorUrl,
    provider_name: providerName,
    provider_url: 'https://www.facebook.com',
    type: 'link',
    version: '1.0'
  });
});

// Middleware to catch all incoming Facebook path requests
app.use(async (req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }
  // Ignore static assets or favicon requests
  if (req.path === '/favicon.ico' || req.path === '/robots.txt') {
    return res.status(404).send('Not Found');
  }

  const userAgent = req.headers['user-agent'] || '';
  const isBot = BOT_UA_REGEX.test(userAgent) || req.query.bot === 'true'; // Allow override via ?bot=true for testing

  // Reconstruct the original Facebook URL from the request path and query
  const originalFbUrl = `https://www.facebook.com${req.originalUrl.split('?')[0]}${req.search || ''}`;

  // Parse and get embed config
  const embedInfo = getEmbedInfo(originalFbUrl);

  if (!embedInfo) {
    // If it's not a valid Facebook URL, redirect to Facebook home page
    return res.redirect('https://www.facebook.com');
  }

  // If request is from a normal browser user, redirect them to the canonical Facebook link
  if (!isBot) {
    return res.redirect(embedInfo.canonicalUrl);
  }

  // Request is from a crawler bot (like Discord) -> Serve Rich HTML Embed
  console.log(`[BOT REQUEST] UA: "${userAgent}" | URL: "${embedInfo.canonicalUrl}"`);
  
  const metadata = await scrapeFacebookMetadata(embedInfo.canonicalUrl, embedInfo.embedUrl, embedInfo.type);

  // Construct host details for oembed endpoint
  const host = req.headers.host || `localhost:${PORT}`;
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const oembedUrl = `${protocol}://${host}/oembed?author=${encodeURIComponent(metadata.author)}&author_url=${encodeURIComponent(embedInfo.canonicalUrl)}&provider=${encodeURIComponent('Facebook / xfa')}`;

  // Generate HTML response containing OpenGraph and Twitter tags
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(metadata.title)}</title>
  
  <!-- Theme Color for Discord Sidebar -->
  <meta name="theme-color" content="#1877F2" />
  
  <!-- oEmbed Discovery -->
  <link rel="alternate" type="application/json+oembed" href="${oembedUrl}" title="${escapeHtml(metadata.author)}" />

  <!-- Standard OpenGraph / Facebook Tags -->
  <meta property="og:site_name" content="xfa" />
  <meta property="og:title" content="${escapeHtml(metadata.title)}" />
  <meta property="og:description" content="${escapeHtml(metadata.description || 'Click to open on Facebook')}" />
  <meta property="og:url" content="${embedInfo.canonicalUrl}" />
  
  ${metadata.image ? `<meta property="og:image" content="${metadata.image}" />` : ''}
  
  ${metadata.videoUrl ? `
  <meta property="og:video" content="${metadata.videoUrl}" />
  <meta property="og:video:secure_url" content="${metadata.videoUrl}" />
  <meta property="og:video:type" content="video/mp4" />
  <meta property="og:video:width" content="1280" />
  <meta property="og:video:height" content="720" />
  ` : ''}

  <!-- Twitter / Discord Card Meta Tags -->
  ${metadata.videoUrl ? `
  <meta name="twitter:card" content="player" />
  <meta name="twitter:player" content="${metadata.videoUrl}" />
  <meta name="twitter:player:width" content="1280" />
  <meta name="twitter:player:height" content="720" />
  ` : metadata.image ? `
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${metadata.image}" />
  ` : `
  <meta name="twitter:card" content="summary" />
  `}
  
  <meta name="twitter:title" content="${escapeHtml(metadata.title)}" />
  <meta name="twitter:description" content="${escapeHtml(metadata.description || 'Click to open on Facebook')}" />

  <!-- Instant Browser Redirect in case bot query override is used or Javascript is enabled -->
  <meta http-equiv="refresh" content="0; url=${embedInfo.canonicalUrl}" />
</head>
<body>
  <p>Redirecting you to Facebook... If you are not redirected automatically, <a href="${embedInfo.canonicalUrl}">click here</a>.</p>
  <script>
    window.location.href = "${embedInfo.canonicalUrl}";
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  return res.send(html);
});

// Helper to escape HTML characters
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

app.listen(PORT, () => {
  console.log(`xfa scraper server is running on port ${PORT}`);
});
