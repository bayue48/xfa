const axios = require('axios');
const cheerio = require('cheerio');

const BOT_USER_AGENT = 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)';
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function extractAuthor(title) {
  if (!title) return 'Facebook User';
  
  let cleaned = title.trim();

  // Pattern: "Reel by Author"
  if (cleaned.includes('Reel by ')) {
    const match = cleaned.match(/Reel by\s+([^|]+)/i);
    if (match) return match[1].trim();
  }

  // Split by "|"
  if (cleaned.includes('|')) {
    const parts = cleaned.split('|').map(p => p.trim());
    const filtered = parts.filter(p => p.toLowerCase() !== 'facebook');
    if (filtered.length > 0) {
      const last = filtered[filtered.length - 1];
      if (last && !last.includes('views') && !last.includes('reactions')) {
        return last;
      }
      return filtered[0];
    }
  }

  // Split by " - " (dash)
  if (cleaned.includes(' - ')) {
    const parts = cleaned.split(' - ').map(p => p.trim());
    const filtered = parts.filter(p => p.toLowerCase() !== 'facebook');
    if (filtered.length > 0) {
      if (filtered[0].length < 30) {
        return filtered[0];
      }
      return filtered[filtered.length - 1];
    }
  }

  return cleaned;
}

/**
 * Scrapes metadata from a Facebook post/video.
 * @param {string} canonicalUrl The direct Facebook post/video URL.
 * @param {string} embedUrl The fallback Facebook iframe plugin URL.
 * @param {'post' | 'video'} type The type of embed content.
 * @returns {Promise<{title?: string, description?: string, image?: string, videoUrl?: string, author?: string, authorPic?: string}>}
 */
async function scrapeFacebookMetadata(canonicalUrl, embedUrl, type) {
  // 1. Try direct scraping with Discordbot User-Agent
  try {
    console.log(`[SCRAPER] Attempting direct fetch from: ${canonicalUrl}`);
    const response = await axios.get(canonicalUrl, {
      headers: {
        'User-Agent': BOT_USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 8000,
      maxRedirects: 5,
    });

    const html = response.data;
    const $ = cheerio.load(html);

    const meta = {};
    $('meta').each((i, el) => {
      const nameAttr = $(el).attr('name') || $(el).attr('property');
      const content = $(el).attr('content');
      if (nameAttr && content) {
        meta[nameAttr] = content;
      }
    });

    const title = meta['og:title'] || meta['twitter:title'] || $('title').text();
    const description = meta['og:description'] || meta['twitter:description'] || meta['description'];
    const image = meta['og:image'] || meta['twitter:image'];
    const videoUrl = meta['og:video'] || meta['og:video:url'] || meta['og:video:secure_url'];

    if (title || description) {
      console.log(`[SCRAPER] Direct fetch successful for: ${canonicalUrl}`);
      return {
        title: title || 'Facebook Post',
        description: description || '',
        image: image || '',
        videoUrl: videoUrl || '',
        author: extractAuthor(title),
        authorPic: '' // Direct bot request doesn't have an easy selector for profile pics
      };
    }
  } catch (error) {
    console.warn(`[SCRAPER] Direct fetch failed: ${error.message}. Falling back to iframe scraper.`);
  }

  // 2. Fallback to Facebook Embed Iframe Plugin
  try {
    console.log(`[SCRAPER] Attempting fallback iframe fetch: ${embedUrl}`);
    const response = await axios.get(embedUrl, {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 8000
    });

    const html = response.data;
    const $ = cheerio.load(html);

    const metadata = {
      title: 'Facebook Post',
      description: '',
      image: '',
      videoUrl: '',
      author: 'Facebook User',
      authorPic: ''
    };

    // Extract author
    const authorLink = $('a[href*="facebook.com/"]').first() || $('a').first();
    if (authorLink.length) {
      const authorText = authorLink.text().trim();
      if (authorText && authorText.length < 50) {
        metadata.author = authorText;
      }
    }

    // Profile photo
    $('img').each((i, el) => {
      const src = $(el).attr('src');
      const alt = $(el).attr('alt') || '';
      if (src && (src.includes('profile') || src.includes('tprofile') || alt.toLowerCase().includes('profile') || alt.toLowerCase().includes('avatar'))) {
        metadata.authorPic = src;
        return false;
      }
    });

    // Extract description
    let description = '';
    const textSelectors = [
      '._5rgt._5g-5',
      '._5rgt',
      '._5pco',
      '.userContent',
      'div[role="article"] p',
      'div[data-testid="post_message"]',
      '.fbUserContent'
    ];

    for (const selector of textSelectors) {
      const text = $(selector).text().trim();
      if (text) {
        description = text;
        break;
      }
    }

    if (!description) {
      const paragraphs = [];
      $('p').each((i, el) => {
        const txt = $(el).text().trim();
        if (txt) paragraphs.push(txt);
      });
      if (paragraphs.length) {
        description = paragraphs.join('\n');
      }
    }

    if (!description) {
      description = $('body').text().replace(/\s+/g, ' ').trim();
    }

    metadata.description = description;
    if (description) {
      metadata.title = description.substring(0, 60) + (description.length > 60 ? '...' : '');
    }

    // Extract image
    let foundImage = '';
    $('img').each((i, el) => {
      const src = $(el).attr('src');
      if (!src) return;
      
      if (
        src.includes('/rsrc.php/') || 
        src.includes('fbcdn-profile') || 
        src.includes('profile.php') ||
        src.includes('emoji.php') ||
        src.includes('/images/emoji') ||
        src.includes('/assets/')
      ) {
        return;
      }
      
      if (src.includes('fbcdn') && !foundImage) {
        foundImage = src;
      }
    });

    if (!foundImage) {
      $('img').each((i, el) => {
        const src = $(el).attr('src');
        if (src && !src.includes('/rsrc.php/') && !src.includes('profile')) {
          foundImage = src;
          return false;
        }
      });
    }

    metadata.image = foundImage;

    // Video specific handling
    if (type === 'video' || html.includes('hd_src') || html.includes('sd_src') || html.includes('videoUrl')) {
      const hdSrcMatch = html.match(/"hd_src"\s*:\s*"([^"]+)"/);
      const sdSrcMatch = html.match(/"sd_src"\s*:\s*"([^"]+)"/);
      const videoUrlMatch = html.match(/"videoUrl"\s*:\s*"([^"]+)"/);
      
      let videoUrl = '';
      if (hdSrcMatch) {
        videoUrl = decodeJsonUnicode(hdSrcMatch[1]);
      } else if (sdSrcMatch) {
        videoUrl = decodeJsonUnicode(sdSrcMatch[1]);
      } else if (videoUrlMatch) {
        videoUrl = decodeJsonUnicode(videoUrlMatch[1]);
      }

      if (videoUrl) {
        metadata.videoUrl = videoUrl;
      }
      
      const posterMatch = html.match(/"thumb_url"\s*:\s*"([^"]+)"/) || html.match(/"snapshot_src"\s*:\s*"([^"]+)"/);
      if (posterMatch && !metadata.image) {
        metadata.image = decodeJsonUnicode(posterMatch[1]);
      }
    }

    return metadata;
  } catch (error) {
    console.error('[SCRAPER] Fallback iframe fetch failed:', error.message);
    return {
      title: 'Facebook Link',
      description: 'Click to view post on Facebook.',
      image: '',
      videoUrl: '',
      author: 'Facebook',
      authorPic: ''
    };
  }
}

// Decode JSON Unicode escape sequences (e.g. \/ or \u0025)
function decodeJsonUnicode(str) {
  try {
    return JSON.parse(`"${str}"`);
  } catch (e) {
    return str.replace(/\\\//g, '/').replace(/\\u([0-9a-fA-F]{4})/g, (match, grp) => {
      return String.fromCharCode(parseInt(grp, 16));
    });
  }
}

module.exports = {
  scrapeFacebookMetadata
};