# xfa: Facebook Embed Scraper for Discord

`xfa` (similar to `fixupx.com` or `fxtwitter.com`) is a self-hostable Node.js web server that intercepts requests for Facebook posts, videos, reels, and photos, and returns a Discord-optimized HTML page with rich OpenGraph and oEmbed metadata. 

When a user posts a Facebook link in Discord (e.g., `https://xfa-facebook.com/share/r/18EhyfvqST/`), Discord's crawler requests the page. `xfa` scrapes the post details, retrieves direct video streams (`.mp4` CDN URLs) and high-quality preview images, and formats them so Discord can embed the video and image directly in the chat window.

---

## Features

- **Direct Video Embeds**: Scrapes direct Facebook CDN `.mp4` URLs to play reels and videos inline on Discord.
- **Rich Media Previews**: Extracts high-quality post images, descriptions, and authors.
- **Smart User-Agent Routing**: 
  - **Discord/Telegram/Slack/etc. Bots**: Served with customized HTML containing OpenGraph metadata and oEmbed tags.
  - **Normal Users (Browsers)**: Redirected instantly (via HTTP 302 and Javascript backup) to the original Facebook link.
- **oEmbed Integration**: Custom endpoint to display the original publisher/author's name and profile link at the top of the Discord embed.
- **Robust Scraper Fallbacks**:
  1. **Direct Browser emulation** (Highest quality, yields direct video CDN links).
  2. **Direct Bot fallback** (Extracts standard meta tags).
  3. **Iframe Plugin parsing** (Resilient fallback utilizing Facebook's official widgets).

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- npm or pnpm

### Installation

1. Clone or copy this repository to your hosting environment.
2. Install the dependencies:
   ```bash
   npm install
   ```

### Configuration

You can configure the server port by creating a `.env` file in the root directory (optional, defaults to port `3000`):

```env
PORT=3000
```

### Running the Server

Start the production server:
```bash
npm start
```

Or run in development mode:
```bash
npm run dev
```

---

## Testing

To run the URL parser and metadata scraper tests:
```bash
node test.js
```

To run the Express server integration tests:
```bash
node test-server.js
```

---

## How to Use on Discord

1. Host this server on a public domain (e.g., using Fly.io, Railway, Render, or a VPS with Nginx and PM2). Make sure SSL (HTTPS) is enabled, as Discord requires HTTPS for player embeds.
2. When sharing a Facebook link, replace the hostname `facebook.com` (or `www.facebook.com`, `m.facebook.com`, etc.) with your custom domain (e.g., `xfa-fb.com` or `yourdomain.com`).
3. **Example**:
   - Original link: `https://www.facebook.com/share/r/18EhyfvqST/`
   - Modified link: `https://yourdomain.com/share/r/18EhyfvqST/`
4. Discord will fetch the link, parse the OpenGraph/oEmbed tags returned by your server, and show a beautiful inline video player. Normal users who click the link in Discord will be seamlessly redirected back to the official Facebook post.