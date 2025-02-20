const cheerio = require('cheerio');
const { writeFile } = require('fs/promises');
const { ensureDir } = require('fs-extra');
const { MongoClient, ServerApiVersion } = require('mongodb');
const path = require('path');

const MONGO_PWD = process.env.MONGO_PWD;

const uri = `mongodb+srv://xiaochuan:${MONGO_PWD}@cluster0.ei6dm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function download({ url, index }) {
  const _arr = url.split('/');
  const filename = _arr[_arr.length - 1].replace('_freemagazinespdf_com', '');

  const r = await fetch(url);
  const bs = await r.arrayBuffer();

  const pwd = process.cwd();
  const outDir = path.join(pwd, 'output', index.toString());
  await ensureDir(outDir);

  await writeFile(path.join(outDir, filename), Buffer.from(bs), 'binary');
  return filename;
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

async function d1({ url, index }) {
  const dlink = await getDownloadLink({ url });
  const pdflink = await getPdfUrl(dlink);
  const filename = await download({ url: pdflink, index });
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
  const items = $('.generate-columns-container article .entry-title a');

  items.each((index, element) => {
    const e = $(element);
    const title = e.text();
    const url = e.attr('href');

    res.push({
      title,
      url,
    });
  });

  return res;
}

function getBaseVersion() {
  const now = new Date();
  const numericString = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
  ].join('');
 
  return `0.0.1-dev-${numericString}-`;
}

async function writePackagejson(_newPdf, index) {
  
  const version = _newPdf.filter(v => !!v).find(v => v.index === index).version;

  const newPdf = _newPdf.filter(v => !!v).map((v) => {
    return {
      ...v,
    };
  });

  const obj = {
    name: '@xiaochuan-dev/freemagazinespdf',
    version,
    files: ['*.pdf'],
    license: 'MIT',
    publishConfig: {
      access: 'public',
      registry: 'https://registry.npmjs.org/',
    },
    newPdf,
  };

  await writeFile(`./output/${index}/package.json`, JSON.stringify(obj), 'utf-8');
  console.log(`写入package.json`);
}

async function start() {
  await client.connect();
  await client.db('admin').command({ ping: 1 });
  console.log('Pinged your deployment. You successfully connected to MongoDB!');
  const db = client.db('dev');
  const collection = db.collection('magazine');

  const url = 'https://proxy.2239559319.workers.dev/';
  const items = await getListItems(url);

  const newPdf = [];

  const baseVersion = getBaseVersion();

  for (let index = 0; index < items.length; index++) {
    const item = items[index];

    const query = { title: item.title };
    const result = await collection.findOne(query);

    if (result) {
      console.log('数据存在:', result);
      newPdf.push(null);
    } else {
      const { filename, pdflink } = await d1({ url: item.url, index });

      const result = await collection.insertOne({
        filename,
        title: item.title,
        pdflink,
      });
      console.log('插入成功，文档 ID:', result.insertedId);

      const version = `${baseVersion}${index}`;
      newPdf.push({
        filename,
        title: item.title,
        pdflink,
        index,
        version
      });
    }
  }

  for (let index = 0; index < newPdf.length; index++) {
    const item = newPdf[index];

    if (item) {
      await writePackagejson(newPdf, index);
    }
  }

  await client.close();
}

start();
