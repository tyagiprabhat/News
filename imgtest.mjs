import Parser from 'rss-parser';
const parser = new Parser({
  headers: { 'User-Agent': 'NewsAI/1.0 (RSS Reader)' },
  timeout: 8000,
  customFields: { item: [
    ['media:content', 'mediaContent', { keepArray: true }],
    ['media:thumbnail', 'mediaThumbnail'],
    ['content:encoded', 'contentEncoded'],
  ]},
});
const feeds = {
  bbc: 'http://feeds.bbci.co.uk/news/rss.xml',
  guardian: 'https://www.theguardian.com/world/rss',
  toi: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
};
for (const [k, url] of Object.entries(feeds)) {
  try {
    const feed = await parser.parseURL(url);
    const item = feed.items[0];
    const enc = item.enclosure?.url;
    const mc = item.mediaContent?.find(m => m.$?.url)?.$?.url;
    const mt = (Array.isArray(item.mediaThumbnail) ? item.mediaThumbnail[0] : item.mediaThumbnail)?.$?.url;
    const img = (item.contentEncoded || item.content || '').match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
    console.log(k, '=>', (enc || mc || mt || img || 'NO IMAGE').slice(0, 90));
  } catch (e) { console.log(k, 'ERR', e.message); }
}
