const axios = require('axios');
const { cleanFacebookUrl, getEmbedInfo } = require("./src/utils/urlParser");
const { scrapeFacebookMetadata } = require("./src/services/scraper");

async function testUrlParser() {
  console.log("--- Testing URL Parser ---");

  const testUrls = [
    "https://www.facebook.com/share/p/14gpmAHmpvn/",
    "https://www.facebook.com/share/p/1Gs7pfW2GD/",
    "https://www.facebook.com/groups/555391129439464/?multi_permalinks=1569506164694617",
    "https://www.facebook.com/watch/?v=2017473752494380",
    "https://www.facebook.com/reel/1792980358348996",
    "https://www.facebook.com/share/r/18EhyfvqST/",
    "https://www.facebook.com/photo/?fbid=1590598709737086&set=a.459067266223575",
    "https://www.facebook.com/NASA/posts/pfbid021YhnWGbLoKnXkZ7MujC6rFTmYcnsUx9thDjHLvuQzgazGVtG4Vm26YVBCVvCKdWl",
    "https://fb.watch/yG4QOQkYl6/",
    "https://www.facebook.com/photo/?fbid=122129143449186921&set=gm.4003615883105784&idorvanity=3791219181012123",
    "https://www.facebook.com/groups/3791219181012123/?multi_permalinks=4003615883105784&hoisted_section_header_type=recently_seen&__cft__[0]=AZZkU-FBbAbpcKLVCyao8_D63t4S38wqxx16-0DJoqSjgrPwIspRMqXaf0qGHsMJAoxfVkMwcJgAoKFlTXoPpg_0ydVCri6OXYZEVBMJHbmvaq4edSAF3mLlpHGA5BFKzj6L5FMZTquQ2iHp11mOUB-t8OvycUfrDievMFA86HwHI08ZHQvop-t5Epcflu9QukNfhGU_VUvw87xPQhEk8hSn&__tn__=%2CO%2CP-R",
    "https://www.facebook.com/permalink.php?story_fbid=pfbid0czTC6S6Wke1XTbHgkKgpaf7iwYrH7843KtbFQNZf5g2DwDT5Nrhcg71ETZSYXwCCl&id=61554055899100",
    "https://www.facebook.com/reel/794485958765443",
    "https://www.facebook.com/share/v/1A4qUVWovM"
  ];

  for (const url of testUrls) {
    const cleaned = cleanFacebookUrl(url);
    const info = getEmbedInfo(url);
    console.log(`Original: ${url}`);
    console.log(`Cleaned:  ${cleaned}`);
    console.log(`Type:     ${info ? info.type : "null"}`);
    console.log(`Embed:    ${info ? info.embedUrl : "null"}`);
    console.log("-----------------------------------");
  }
}

async function testScraper() {
  console.log("\n--- Testing Scraper ---");
  const testUrls = [
    {
      name: "NASA Post",
      url: "https://www.facebook.com/NASA/posts/pfbid021YhnWGbLoKnXkZ7MujC6rFTmYcnsUx9thDjHLvuQzgazGVtG4Vm26YVBCVvCKdWl",
    },
    {
      name: "Watch Video",
      url: "https://www.facebook.com/watch/?v=2017473752494380",
    },
    { name: "Share Reel", url: "https://www.facebook.com/share/r/18EhyfvqST/" },
    { name: "fb.watch Video", url: "https://fb.watch/yG4QOQkYl6/" },
    {
      name: "Group Post from Screenshot (Raw)",
      url: "https://www.facebook.com/groups/3791219181012123/?multi_permalinks=4003931516407554",
    },
    {
      name: "Photo from Server Log",
      url: "https://www.facebook.com/photo/?fbid=1522913582619102&set=a.221185916125215",
    },
    {
      name: "Failing Photo URL from Screenshot 1",
      url: "https://www.facebook.com/photo/?fbid=1286028850346136&set=gm.1298622039097247"
    }
  ];

  for (const item of testUrls) {
    console.log(`\nScraping ${item.name} (${item.url})...`);
    const info = getEmbedInfo(item.url);
    if (!info) {
      console.error(`Failed to get embed info for: ${item.url}`);
      continue;
    }
    const metadata = await scrapeFacebookMetadata(
      info.canonicalUrl,
      info.embedUrl,
      info.type,
    );
    console.log("Scraped Metadata Results:");
    console.log(JSON.stringify(metadata, null, 2));
  }
}

async function testIframeFallback() {
  console.log("\n--- Testing Iframe Fallback Directly ---");
  const iframeUrls = [
    {
      name: "Photo Embed from Screenshot",
      url: "https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Fphoto%2F%3Ffbid%3D1758800962168279%26set%3Da.464030554978666&show_text=true&width=500"
    },
    {
      name: "Group Embed from Screenshot (Raw)",
      url: "https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Fgroups%2F3791219181012123%2F%3Fmulti_permalinks%3D4003931516407554%26hoisted_section_header_type%3Drecently_seen&show_text=true&width=500"
    },
    {
      name: "Group Embed from Screenshot (Rewritten to posts/post_id)",
      url: "https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Fgroups%2F3791219181012123%2Fposts%2F4003931516407554%2F&show_text=true&width=500"
    },
    {
      name: "Photo Embed from Server Log",
      url: "https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Fphoto%2F%3Ffbid%3D1522913582619102%26set%3Da.221185916125215&show_text=true&width=500"
    }
  ];

  const browserUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const botUA = 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)';

  for (const item of iframeUrls) {
    console.log(`\n--- ${item.name} ---`);
    for (const uaType of ['Browser UA', 'Bot UA']) {
      const ua = uaType === 'Browser UA' ? browserUA : botUA;
      try {
        const response = await axios.get(item.url, {
          headers: { 'User-Agent': ua },
          validateStatus: status => true
        });
        console.log(`  UA: ${uaType} -> Status: ${response.status}`);
        if (response.status !== 200) {
          console.log(`  UA: ${uaType} -> Data (first 200 chars):`, response.data.substring(0, 200));
        }
      } catch (error) {
        console.error(`  UA: ${uaType} -> Error: ${error.message}`);
      }
    }
  }
}

async function runAllTests() {
  await testUrlParser();
  try {
    await testScraper();
  } catch (err) {
    console.error("Scraper test encountered an error:", err.message);
  }
  await testIframeFallback();
}

runAllTests();
