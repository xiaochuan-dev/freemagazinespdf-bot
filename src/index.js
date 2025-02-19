const { writeFile } = require('fs/promises');
const fs = require('fs');
const { MongoClient, ServerApiVersion } = require('mongodb');
const path = require('path');

const uri = `mongodb+srv://xiaochuan:${process.env.MONGO_PWD}@cluster0.ei6dm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const token = process.env.TELEGRAM_BOT_TOKEN;
const groupId = '-1002498689008';

class Bot {
  client;
  constructor() {
    this.client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });
  }

  async download(url) {
    const _arr = url.split('/');
    const name = _arr[_arr.length - 1];

    const r1 = await fetch(url);
    const bs = await r1.arrayBuffer();
    const currentDirectory = process.cwd();
    const filePath = path.join(currentDirectory, 'output', name);

    await writeFile(filePath, Buffer.from(bs), 'binary');

    return {
      filePath,
      filename: name,
    };
  }

  async sendFile(filePath, title, filename) {
    const url = `https://api.telegram.org/bot${token}/sendDocument`;

    const formData = new FormData();
    formData.append('chat_id', groupId);
    formData.append(
      'document',
      fs.createReadStream(filePath, {
        filename,
      })
    );
    formData.append('caption', title);

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    const t = await response.text();

    console.log(t);

    // const result = await response.json();
    // if (result.ok) {
    //   console.log('文件已发送:', result);
    // } else {
    //   console.error('发送文件失败:', result.description);
    // }
  }

  async run() {
    await this.client.connect();
    await this.client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );

    const database = this.client.db('dev');

    const magazineNewCollection = database.collection('magazine_new');
    const magazineCollection = database.collection('magazine');
    const magazineNewList = await magazineNewCollection.find({}).toArray();

    for (const item of magazineNewList) {
      const { title, url, _id } = item;
      const { filePath, filename } = await this.download(url);

      await this.sendFile(filePath, title, filename);

      await magazineCollection.insertOne({
        title,
        url,
      });
      await magazineNewCollection.deleteOne({ _id });
    }
  }
}

(async () => {
  const bot = new Bot();

  await bot.run();
})();
