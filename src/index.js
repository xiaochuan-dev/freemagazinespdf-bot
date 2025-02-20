const cheerio = require('cheerio');

async function getPdfUrl(downloadLink) {
  const r = await fetch(downloadLink);
  const text = await r.text();

  const _arr = text.match(/"docUrl":"(.+?)"/);

  if (_arr[1]) {
    return _arr[1].replace(/\\/g, '');
  } else {
    return null;
  }
}

async function getDownloadLink({ url }) {
  const r = await fetch(url);
  const text = await r.text();

  const $ = cheerio.load(text);

  const downloadLink = $('.wp-block-button a').attr('href');
  return downloadLink;
}

async function getListItems(url) {
  const r = await fetch(url);
  const text = await r.text();

  const $ = cheerio.load(text);

  const res = [];
  const items = $('.generate-columns-container article .entry-title a');

  items.each((index, element) => {
    const e = $(element);
    const title = e.text();
    const url = e.attr('href');

    res.push({
      title,
      url
    });
  });

  const dlink = await getDownloadLink({ url: res[0].url })
  console.log(await getPdfUrl(dlink));

  return res;
}

getListItems('https://proxy.2239559319.workers.dev/');
