const { cleanFacebookUrl, getEmbedInfo } = require('./src/utils/urlParser');
const { scrapeFacebookMetadata } = require('./src/services/scraper');

async function testUrlParser() {
  console.log('--- Testing URL Parser ---');
  
  const testUrls = [
    'https://www.facebook.com/share/p/14gpmAHmpvn/',
    'https://www.facebook.com/share/p/1Gs7pfW2GD/',
    'https://www.facebook.com/groups/555391129439464/?multi_permalinks=1569506164694617',
    'https://www.facebook.com/watch/?v=2017473752494380',
    'https://www.facebook.com/reel/1792980358348996',
    'https://www.facebook.com/share/r/18EhyfvqST/',
    'https://www.facebook.com/photo/?fbid=1590598709737086&set=a.459067266223575',
    'https://www.facebook.com/NASA/posts/pfbid021YhnWGbLoKnXkZ7MujC6rFTmYcnsUx9thDjHLvuQzgazGVtG4Vm26YVBCVvCKdWl',
    'https://fb.watch/yG4QOQkYl6/'
  ];

  for (const url of testUrls) {
    const cleaned = cleanFacebookUrl(url);
    const info = getEmbedInfo(url);
    console.log(`Original: ${url}`);
    console.log(`Cleaned:  ${cleaned}`);
    console.log(`Type:     ${info ? info.type : 'null'}`);
    console.log(`Embed:    ${info ? info.embedUrl : 'null'}`);
    console.log('-----------------------------------');
  }
}

async function testScraper() {
  console.log('\n--- Testing Scraper ---');
  const testUrls = [
    { name: 'NASA Post', url: 'https://www.facebook.com/NASA/posts/pfbid021YhnWGbLoKnXkZ7MujC6rFTmYcnsUx9thDjHLvuQzgazGVtG4Vm26YVBCVvCKdWl' },
    { name: 'Watch Video', url: 'https://www.facebook.com/watch/?v=2017473752494380' },
    { name: 'Share Reel', url: 'https://www.facebook.com/share/r/18EhyfvqST/' },
    { name: 'fb.watch Video', url: 'https://fb.watch/yG4QOQkYl6/' }
  ];

  for (const item of testUrls) {
    console.log(`\nScraping ${item.name} (${item.url})...`);
    const info = getEmbedInfo(item.url);
    if (!info) {
      console.error(`Failed to get embed info for: ${item.url}`);
      continue;
    }
    const metadata = await scrapeFacebookMetadata(info.canonicalUrl, info.embedUrl, info.type);
    console.log('Scraped Metadata Results:');
    console.log(JSON.stringify(metadata, null, 2));
  }
}

async function runAllTests() {
  await testUrlParser();
  try {
    await testScraper();
  } catch (err) {
    console.error('Scraper test encountered an error:', err.message);
  }
}

runAllTests();