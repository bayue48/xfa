# xfa (Facebook Scraper & Embedder for Discord)

`xfa` is a Node.js-based web server designed to fix Facebook link previews on Discord, Telegram, Slack, and other platforms, similar to how `fixupx.com` / `fxtwitter.com` works for X/Twitter.

When a Facebook link is shared directly on Discord, it often fails to display an embed, shows generic metadata, or misses images/videos. By replacing the `facebook.com` domain with your hosted `xfa` domain, you get fully populated rich embeds containing the post title, description, images, and author metadata.

---

## How It Works

1. **User shares a modified link** on Discord, e.g., `https://xfa.gsdm.site/share/p/14gpmAHmpvn/` instead of `https://facebook.com/share/p/14gpmAHmpvn/`.
2. **Discord's crawler bot** (identified by its User-Agent) requests the link from your `xfa` server.
3. **The `xfa` server** fetches the post page from Facebook using a bot User-Agent (which bypasses Facebook's login walls/heavy JS and returns raw server-rendered meta tags). If that fails, it falls back to parsing Facebook's Embedded Iframe Plugin.
4. **The server returns a custom HTML page** containing OpenGraph, Twitter Player Card, and oEmbed metadata tags designed for Discord's embeds.
5. **Discord displays the rich preview card** (complete with Title, Author Name, Post Content/Description, Images, or Video Player).
6. **When a human user clicks the link**, the server detects a normal browser User-Agent and redirects them instantly (HTTP 302 / Javascript fallback) to the original Facebook post URL.

---

## Project Structure

- `src/server.js`: The main Express server. Handles routing, User-Agent detection, oEmbed generation, and redirects.
- `src/services/scraper.js`: Scrapes Facebook metadata using two strategies (direct bot UA requests, falling back to iframe plugins).
- `src/utils/urlParser.js`: Parses and reconstructs different Facebook link types (posts, watch/videos, reels, group posts, photos, share links).
- `test.js`: Performs local parsing and scraping validation tests.

---

## Local Setup & Testing

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Tests
To test parsing and live scraping functionality locally:
```bash
npm test
```

### 3. Start Server Locally
```bash
npm start
```
The server will run on port `3000` (or the port defined in your `.env` file).

To test how it looks to a bot locally, append `?bot=true` to any path, e.g., `http://localhost:3000/share/p/14gpmAHmpvn/?bot=true`.

---

## How to Deploy

To use this on Discord, the server must be hosted on a public URL. You can deploy it to any cloud provider:

### Option A: Railway / Render (Easiest)
1. Push this repository to GitHub.
2. Sign up on [Railway.app](https://railway.app) or [Render.com](https://render.com).
3. Connect your GitHub repository.
4. Deploy as a Node.js web service.
5. Copy your service's public domain (e.g. `your-app.up.railway.app` or `your-app.onrender.com`).

### Option B: VPS (Virtual Private Server)
1. Clone the repository to your VPS.
2. Run `npm install`.
3. Use a process manager like `pm2` to run the app in the background:
   ```bash
   npm install -g pm2
   pm2 start src/server.js --name "xfa-embed"
   ```
4. Set up Nginx or Caddy as a reverse proxy pointing to port `3000` with SSL enabled.

### Option C: Docker (Production)
We provide a production-ready `Dockerfile` and `.dockerignore`.

1. **Build the Docker Image**:
   ```bash
   docker build -t xfa-embed:latest .
   ```

2. **Run the Container**:
   Run the container in detached mode (background) and map port `3000` of the host to port `3000` of the container:
   ```bash
   docker run -d --name xfa-embed-prod -p 3000:3000 --restart unless-stopped xfa-embed:latest
   ```

3. **Production Considerations**:
   - Set the `PORT` environment variable if needed by passing `-e PORT=YOUR_PORT`.
   - Set up a reverse proxy (like Nginx, Caddy, or Traefik) on your host to point to port `3000` and handle HTTPS/SSL. Discord requires links to use `https://` for embeds to render correctly.

---

## How to Use on Discord

Once your server is deployed to a public domain (e.g. `xfa.gsdm.site`):

1. **Copy** the original Facebook URL you want to share.
2. **Replace** `facebook.com` (or `fb.watch`) with your domain name.

### Examples:
- **Standard Post**:
  - Original: `https://www.facebook.com/NASA/posts/pfbid021YhnWGbLoKnXkZ7MujC6rFTmYcnsUx9thDjHLvuQzgazGVtG4Vm26YVBCVvCKdWl`
  - Share on Discord: `https://xfa.gsdm.site/NASA/posts/pfbid021YhnWGbLoKnXkZ7MujC6rFTmYcnsUx9thDjHLvuQzgazGVtG4Vm26YVBCVvCKdWl`

- **Short Share Link**:
  - Original: `https://www.facebook.com/share/p/14gpmAHmpvn/`
  - Share on Discord: `https://xfa.gsdm.site/share/p/14gpmAHmpvn/`

- **Watch Video**:
  - Original: `https://www.facebook.com/watch/?v=2017473752494380`
  - Share on Discord: `https://xfa.gsdm.site/watch/?v=2017473752494380`

- **Reel**:
  - Original: `https://www.facebook.com/share/r/18EhyfvqST/`
  - Share on Discord: `https://xfa.gsdm.site/share/r/18EhyfvqST/`
