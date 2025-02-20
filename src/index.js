const cheerio = require('cheerio');
const { writeFile } = require('fs/promises');

async function download({ url, title }) {
  const _arr = url.split('/');
  const filename = _arr[_arr.length - 1];

  const r = await fetch(url);
  const bs = await r.arrayBuffer();

  await writeFile(`./output/${filename}`, Buffer.from(bs), 'binary');

}

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

async function d1({ url, title }) {
  const dlink = await getDownloadLink({ url });
  const pdflink = await getPdfUrl(dlink);
  await download({ url: pdflink, title });
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

  await d1({url: res[0].url, title: res[0].title  });

  return res;
}

getListItems('https://proxy.2239559319.workers.dev/');
