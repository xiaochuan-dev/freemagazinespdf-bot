const cheerio = require('cheerio');
const { MongoClient, ServerApiVersion } = require('mongodb');
const path = require('path');
const { sendMessage } = require('./bot');

const MONGO_PWD = process.env.MONGO_PWD;

const uri = `mongodb+srv://xiaochuan:${MONGO_PWD}@cluster0.ei6dm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

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

async function d1({ url, index }) {
  const dlink = await getDownloadLink({ url });
  const pdflink = await getPdfUrl(dlink);
  const _arr = url.split('/');
  const filename = _arr[_arr.length - 1].replace('_freemagazinespdf_com', '');

  return {
    filename,
    pdflink,
  };
}

async function getListItems(url) {
  const r = await fetch(url);
  const text = await r.text();

  const $ = cheerio.load(text);

  const res = [];
  const items = $('.generate-columns-container article');

  items.each((index, element) => {
    const e = $(element).find('.entry-title a');
    const title = e.text();
    const url = e.attr('href');

    const img = $(element).find('.post-image img').attr('src');

    res.push({
      title,
      url,
      img,
    });
  });

  return res;
}

async function start() {
  await client.connect();
  await client.db('admin').command({ ping: 1 });
  console.log('Pinged your deployment. You successfully connected to MongoDB!');
  const db = client.db('dev');
  const collection = db.collection('magazine');

  const urls = [
    'https://freemagazinespdf.com/',
    'https://freemagazinespdf.com/page/2/',
    'https://freemagazinespdf.com/page/3/',
    'https://freemagazinespdf.com/page/4/',
    'https://freemagazinespdf.com/page/5/',
  ];

  const items = [];
  for (const url of urls) {
    const _items = await getListItems(url);
    items.push(..._items);
  }

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    try {
      const query = { title: item.title };
      const result = await collection.findOne(query);

      if (result) {
        console.log('数据存在:', result.pdflink);
      } else {
        const { filename, pdflink } = await d1({ url: item.url, index });

        const result = await collection.insertOne({
          filename,
          title: item.title,
          pdflink,
        });
        console.log('插入成功，文档 ID:', result.insertedId);

        await sendMessage(
`${item.img}

[${item.title}](${pdflink})`
);
      }
    } catch (error) {
      console.log(error);
    }
  }

  await client.close();
}

start();
