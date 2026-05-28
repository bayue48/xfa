/**
 * Normalizes Facebook URLs into standard formats.
 * Facebook has multiple link styles:
 * 1. Post: https://www.facebook.com/username/posts/post_id
 * 2. Photo: https://www.facebook.com/photo.php?fbid=xxx&set=a.xxx
 * 3. Photo alternative: https://www.facebook.com/photo/?fbid=xxx&set=a.xxx
 * 4. Video: https://www.facebook.com/username/videos/video_id
 * 5. Reel: https://www.facebook.com/reel/reel_id
 * 6. Permalink/Alternative: https://www.facebook.com/permalink.php?story_fbid=xxx&id=xxx
 * 7. Watch: https://www.facebook.com/watch/?v=video_id
 * 8. Shared Group Link: https://www.facebook.com/groups/group_id/posts/post_id
 * 9. Subdomains: m.facebook.com, web.facebook.com, touch.facebook.com, etc.
 * 
 * We need to extract the original canonical link that can be passed to the 
 * Facebook post or video embed plugins.
 */

function cleanFacebookUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    
    // Replace mobile, touch, basic, web, etc. subdomains with www
    if (parsed.hostname.endsWith('facebook.com') || parsed.hostname.endsWith('fb.watch')) {
      parsed.hostname = 'www.facebook.com';
    } else {
      return null;
    }

    // Clean tracking query parameters
    const params = new URLSearchParams(parsed.search);
    const cleanedParams = new URLSearchParams();
    
    // Retain only necessary query parameters for specific pages
    const keysToKeep = ['fbid', 'set', 'story_fbid', 'id', 'v'];
    keysToKeep.forEach(key => {
      if (params.has(key)) {
        cleanedParams.set(key, params.get(key));
      }
    });

    parsed.search = cleanedParams.toString();
    return parsed.toString();
  } catch (e) {
    return null;
  }
}

/**
 * Determines whether the URL is a post or a video (since Facebook has different iframe embed plugins for each).
 * @param {string} url 
 * @returns {{ type: 'post' | 'video', embedUrl: string, canonicalUrl: string }}
 */
function getEmbedInfo(url) {
  const cleanedUrl = cleanFacebookUrl(url);
  if (!cleanedUrl) return null;

  const urlObj = new URL(cleanedUrl);
  const path = urlObj.pathname;
  
  let type = 'post';

  // Check if it's a video/reel
  if (
    path.includes('/videos/') ||
    path.includes('/watch') ||
    path.startsWith('/reel/') ||
    urlObj.searchParams.has('v')
  ) {
    type = 'video';
  }

  // The Facebook iframe plugins use the format:
  // Post: https://www.facebook.com/plugins/post.php?href=CANONICAL_URL&show_text=true
  // Video: https://www.facebook.com/plugins/video.php?href=CANONICAL_URL&show_text=true
  let embedUrl;
  if (type === 'video') {
    embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(cleanedUrl)}&show_text=true&width=500`;
  } else {
    embedUrl = `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(cleanedUrl)}&show_text=true&width=500`;
  }

  return {
    type,
    embedUrl,
    canonicalUrl: cleanedUrl
  };
}

module.exports = {
  cleanFacebookUrl,
  getEmbedInfo
};