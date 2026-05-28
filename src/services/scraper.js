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

function isGenericTitle(t) {
  if (!t) return true;
  const lower = t.toLowerCase().trim();
  return (
    lower === 'facebook' ||
    lower === 'facebook post' ||
    lower === 'facebook video' ||
    lower === 'facebook image' ||
    lower === 'facebook picture' ||
    lower === 'discover popular videos | facebook' ||
    lower.includes('log into facebook') ||
    lower.includes('log in to facebook')
  );
}

function isMetadataGeneric(meta) {
  const titleGeneric = isGenericTitle(meta.title);
  const descGeneric = !meta.description || isGenericTitle(meta.description) || meta.description === 'Click to open on Facebook';
  const noImage = !meta.image;
  const noVideo = !meta.videoUrl;
  const noAuthor = !meta.author || meta.author === 'Facebook User' || meta.author === 'Facebook';
  
  return titleGeneric && descGeneric && noImage && noVideo && noAuthor;
}

function cleanFinalMetadata(meta, type) {
  let title = meta.title || '';
  let description = meta.description || '';
  let author = meta.author || 'Facebook User';
  let image = meta.image || '';
  let videoUrl = meta.videoUrl || '';

  // Clean Author
  if (!author || isGenericTitle(author)) {
    author = 'Facebook User';
  }
  
  // Clean Title
  title = title.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  
  // If title has views and reactions, parse out the real title
  if (title.includes('views') && title.includes('reactions') && title.includes('|')) {
    const parts = title.split('|').map(p => p.trim());
    if (parts.length > 1 && parts[1]) {
      title = parts[1];
    }
  }

  // Remove trailing author suffix from title, e.g. " | Facebook" or " | AuthorName"
  if (title.includes('|')) {
    const parts = title.split('|').map(p => p.trim());
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1].toLowerCase();
      if (lastPart === 'facebook' || lastPart.includes('reels') || lastPart === author.toLowerCase()) {
        parts.pop();
        title = parts.join(' | ');
      }
    }
  }

  // If title is generic, fallback
  if (isGenericTitle(title)) {
    if (description && !isGenericTitle(description)) {
      title = description;
    } else {
      title = type === 'video' ? 'Facebook Video' : 'Facebook Post';
    }
  }

  // Clean Description
  description = description.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (isGenericTitle(description)) {
    description = '';
  }

  // If description is empty, use title as a fallback (or some standard text)
  if (!description) {
    description = 'Click to open on Facebook';
  }

  // Ensure title and description length limit
  if (title.length > 150) {
    title = title.substring(0, 147) + '...';
  }
  if (description.length > 300) {
    description = description.substring(0, 297) + '...';
  }

  return {
    title,
    description,
    image,
    videoUrl,
    author,
    authorPic: ''
  };
}

function extractFromJson(html) {
  const metadata = {};
  
  // 1. Author
  const actorRegex = /"actors"\s*:\s*\[\s*\{\s*(?:[^{}]*?)"name"\s*:\s*"([^"]+)"/i;
  const actorMatch = html.match(actorRegex);
  if (actorMatch) {
    metadata.author = decodeJsonUnicode(actorMatch[1]);
  }

  // 2. Message / Description
  const messageRegex = /"message"\s*:\s*\{\s*(?:[^{}]*?)"text"\s*:\s*"([^"]+)"/i;
  const messageMatch = html.match(messageRegex);
  if (messageMatch) {
    metadata.description = decodeJsonUnicode(messageMatch[1]);
  }

  // 3. SEO Title
  const seoTitleRegex = /"seo_title"\s*:\s*"([^"]+)"/i;
  const seoTitleMatch = html.match(seoTitleRegex);
  if (seoTitleMatch) {
    metadata.seoTitle = decodeJsonUnicode(seoTitleMatch[1]);
  }

  // 4. Image
  const imageRegex = /"image"\s*:\s*\{\s*(?:[^{}]*?)"uri"\s*:\s*"([^"]+)"/i;
  const imageMatch = html.match(imageRegex);
  if (imageMatch) {
    metadata.image = decodeJsonUnicode(imageMatch[1]);
  }
  
  return metadata;
}

/**
 * Scrapes metadata from a Facebook post/video.
 * @param {string} canonicalUrl The direct Facebook post/video URL.
 * @param {string} embedUrl The fallback Facebook iframe plugin URL.
 * @param {'post' | 'video'} type The type of embed content.
 * @returns {Promise<{title?: string, description?: string, image?: string, videoUrl?: string, author?: string, authorPic?: string}>}
 */
async function scrapeFacebookMetadata(canonicalUrl, embedUrl, type) {
  // 1. Try scraping with BROWSER_USER_AGENT (Chrome) first, as it yields high-quality metadata and video stream links.
  try {
    console.log(`[SCRAPER] Attempting browser-agent fetch from: ${canonicalUrl}`);
    const response = await axios.get(canonicalUrl, {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
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
    
    let videoUrl = '';
    // If this is a video or reel, search for playable CDN links
    if (type === 'video' || html.includes('fbcdn.net')) {
      const regex = /https?:(?:\\\/\\\/|)[^\s"']+?video[^\s"']+?fbcdn\.net[^\s"']+/gi;
      const matches = html.match(regex) || [];
      
      // Clean and normalize URLs
      const unique = [...new Set(matches)].map(m => {
        let clean = m;
        // Truncate at XML/HTML tags (like \u003c / u003c / <)
        clean = clean.split(/\\u003c|u003c|\\u003C|u003C|<|\\u003e|u003e|\\u003E|u003E|>/)[0];
        // Normalize characters
        clean = clean.replace(/\\u0025/g, '%')
                     .replace(/\\u0026/g, '&')
                     .replace(/\\u003d/g, '=')
                     .replace(/\\\//g, '/')
                     .replace(/\\/g, '');
        return clean;
      });

      // Try to find progressive streams containing both audio and video
      const candidates = [];
      for (const u of unique) {
        const efgMatch = u.match(/[?&]efg=([^&"'#]+)/);
        if (efgMatch) {
          try {
            const base64 = decodeURIComponent(efgMatch[1]);
            const json = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
            candidates.push({ url: u, efg: json });
          } catch (e) {
            candidates.push({ url: u, efg: null });
          }
        } else {
          candidates.push({ url: u, efg: null });
        }
      }

      // Filter for progressive streams (contain "progressive" in vencode_tag, not "audio")
      const progressive = candidates.filter(c => {
        if (!c.efg || !c.efg.vencode_tag) return false;
        const tag = c.efg.vencode_tag.toLowerCase();
        return tag.includes('progressive') && !tag.includes('audio');
      });

      if (progressive.length > 0) {
        // Sort: prefer HD progressive over SD progressive
        const bestProgressive = progressive.sort((a, b) => {
          const tagA = a.efg.vencode_tag.toLowerCase();
          const tagB = b.efg.vencode_tag.toLowerCase();
          const getRes = tag => {
            const match = tag.match(/(\d+)p/);
            if (match) return parseInt(match[1], 10);
            if (tag.includes('720')) return 720;
            if (tag.includes('1080')) return 1080;
            if (tag.includes('360')) return 360;
            if (tag.includes('480')) return 480;
            if (tag.includes('_sd')) return 360;
            if (tag.includes('_hd')) return 720;
            return 0;
          };
          return getRes(tagB) - getRes(tagA);
        })[0];

        videoUrl = bestProgressive.url;
        console.log(`[SCRAPER] Selected progressive video stream (with audio): ${videoUrl.substring(0, 80)}...`);
      } else {
        // Fallback to original matching logic if no progressive stream is found
        const foundVideo = unique.find(u => u.includes('/v/') || u.includes('/m366/') || u.includes('/m412/') || u.includes('.mp4') || u.includes('video.f'));
        if (foundVideo) {
          videoUrl = foundVideo;
          console.log(`[SCRAPER] Fallback direct video URL selected: ${videoUrl.substring(0, 80)}...`);
        }
      }
    }

    const jsonMeta = extractFromJson(html);

    if (title || description || jsonMeta.description || jsonMeta.seoTitle || jsonMeta.author) {
      console.log(`[SCRAPER] Browser-agent fetch successful for: ${canonicalUrl}`);
      
      let author = extractAuthor(title);
      if ((!author || author.toLowerCase() === 'facebook' || author.toLowerCase() === 'facebook user') && jsonMeta.author) {
        author = jsonMeta.author;
      } else if (jsonMeta.author && (!author || author.length > 40)) {
        author = jsonMeta.author;
      }

      let resolvedDescription = jsonMeta.description || description || '';
      if (!resolvedDescription || resolvedDescription.includes('Log into Facebook') || resolvedDescription.includes('Click to open on Facebook')) {
        resolvedDescription = jsonMeta.seoTitle || '';
      }

      let resolvedTitle = title || '';
      if (isGenericTitle(resolvedTitle)) {
        if (jsonMeta.seoTitle) {
          resolvedTitle = jsonMeta.seoTitle;
        } else if (jsonMeta.description) {
          resolvedTitle = jsonMeta.description;
        } else if (author && !isGenericTitle(author)) {
          resolvedTitle = type === 'video' ? `${author}'s Video` : `${author}'s Post`;
        } else {
          resolvedTitle = type === 'video' ? 'Facebook Video' : 'Facebook Post';
        }
      }

      if (resolvedTitle && resolvedTitle.length > 150) {
        resolvedTitle = resolvedTitle.substring(0, 147) + '...';
      }

      const resolvedImage = jsonMeta.image || image || '';

      const finalMeta = cleanFinalMetadata({
        title: resolvedTitle,
        description: resolvedDescription,
        image: resolvedImage,
        videoUrl: videoUrl,
        author: author,
        authorPic: ''
      }, type);

      if (isMetadataGeneric(finalMeta)) {
        throw new Error('Browser-agent retrieved only generic login wall metadata');
      }
      return finalMeta;
    }
  } catch (error) {
    console.warn(`[SCRAPER] Browser-agent fetch failed: ${error.message}. Trying bot-agent fetch.`);
  }

  // 2. Try direct scraping with Discordbot User-Agent (Fallback 1)
  try {
    console.log(`[SCRAPER] Attempting bot-agent direct fetch from: ${canonicalUrl}`);
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
    const videoUrl = meta['og:video'] || meta['og:video:url'] || meta['og:video:secure_url'] || '';

    const jsonMeta = extractFromJson(html);

    if (title || description || jsonMeta.description || jsonMeta.seoTitle || jsonMeta.author) {
      console.log(`[SCRAPER] Bot-agent direct fetch successful for: ${canonicalUrl}`);
      
      let author = extractAuthor(title);
      if ((!author || author.toLowerCase() === 'facebook' || author.toLowerCase() === 'facebook user') && jsonMeta.author) {
        author = jsonMeta.author;
      } else if (jsonMeta.author && (!author || author.length > 40)) {
        author = jsonMeta.author;
      }

      let resolvedDescription = jsonMeta.description || description || '';
      if (!resolvedDescription || resolvedDescription.includes('Log into Facebook') || resolvedDescription.includes('Click to open on Facebook')) {
        resolvedDescription = jsonMeta.seoTitle || '';
      }

      let resolvedTitle = title || '';
      if (isGenericTitle(resolvedTitle)) {
        if (jsonMeta.seoTitle) {
          resolvedTitle = jsonMeta.seoTitle;
        } else if (jsonMeta.description) {
          resolvedTitle = jsonMeta.description;
        } else if (author && !isGenericTitle(author)) {
          resolvedTitle = type === 'video' ? `${author}'s Video` : `${author}'s Post`;
        } else {
          resolvedTitle = type === 'video' ? 'Facebook Video' : 'Facebook Post';
        }
      }

      if (resolvedTitle && resolvedTitle.length > 150) {
        resolvedTitle = resolvedTitle.substring(0, 147) + '...';
      }

      const resolvedImage = jsonMeta.image || image || '';

      const finalMeta = cleanFinalMetadata({
        title: resolvedTitle,
        description: resolvedDescription,
        image: resolvedImage,
        videoUrl: videoUrl,
        author: author,
        authorPic: ''
      }, type);

      if (isMetadataGeneric(finalMeta)) {
        throw new Error('Bot-agent retrieved only generic login wall metadata');
      }
      return finalMeta;
    }
  } catch (error) {
    console.warn(`[SCRAPER] Bot-agent fetch failed: ${error.message}. Trying iframe fallback.`);
  }

  // 3. Fallback to Facebook Embed Iframe Plugin (Fallback 2)
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

    return cleanFinalMetadata(metadata, type);
  } catch (error) {
    console.error('[SCRAPER] Fallback iframe fetch failed:', error.message);
    return cleanFinalMetadata({
      title: 'Facebook Link',
      description: 'Click to view post on Facebook.',
      image: '',
      videoUrl: '',
      author: 'Facebook',
      authorPic: ''
    }, type);
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