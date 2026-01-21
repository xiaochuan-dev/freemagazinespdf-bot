const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
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

// 使用隐身插件
puppeteer.use(StealthPlugin());

class CloudflareBypasser {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async init() {
    console.log('启动浏览器绕过Cloudflare...');

    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    this.page = await this.browser.newPage();

    // 设置真实的用户代理
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // 设置额外的HTTP头
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br'
    });

    // 注入防检测代码
    await this.page.evaluateOnNewDocument(() => {
      // 隐藏webdriver属性
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async fetchWithBypass(url, options = {}) {
    try {
      console.log(`访问: ${url}`);

      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000,
        ...options
      });

      // 等待页面加载
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 检查是否被Cloudflare阻挡
      const isBlocked = await this.page.evaluate(() => {
        return document.title.includes('Just a moment') ||
          document.body.innerText.includes('Checking your browser');
      });

      if (isBlocked) {
        console.log('⚠️ 检测到Cloudflare阻挡，尝试绕过...');

        // 尝试点击可能的验证按钮
        await this.page.evaluate(() => {
          const buttons = document.querySelectorAll('button, input[type="submit"]');
          for (let btn of buttons) {
            const text = (btn.textContent || btn.value || '').toLowerCase();
            if (text.includes('verify') || text.includes('continue') || text.includes('submit')) {
              btn.click();
              return;
            }
          }
        });

        // 等待验证完成
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // 获取页面内容
      const content = await this.page.content();
      return content;

    } catch (error) {
      console.error(`访问 ${url} 失败:`, error.message);
      return null;
    }
  }

  async getPdfUrl(downloadLink) {
    const html = await this.fetchWithBypass(downloadLink);
    if (!html) return null;

    const pdfUrlMatch = html.match(/"docUrl":"(.+?)"/);
    if (pdfUrlMatch && pdfUrlMatch[1]) {
      return pdfUrlMatch[1].replace(/\\/g, '');
    }

    // 如果上面的正则没匹配到，尝试其他方式
    const pdfUrlMatch2 = html.match(/(https?:\/\/[^"']+\.pdf[^"']*)/);
    if (pdfUrlMatch2 && pdfUrlMatch2[1]) {
      return pdfUrlMatch2[1];
    }

    return null;
  }

  async getDownloadLink(url) {
    console.log(`获取下载链接，访问: ${url}`);

    try {
      // 1. 访问文章页面
      await this.fetchWithBypass(url);

      // 2. 从文章页面获取预览页面链接
      const previewPageUrl = await this.page.evaluate(() => {
        // 查找下载按钮（指向预览页面）
        const downloadButtons = document.querySelectorAll('a[href*="easyupload.us"]');
        for (const button of downloadButtons) {
          const text = button.textContent.toLowerCase();
          const hasDownloadText = text.includes('download') || text.includes('get') || text.includes('pdf');
          const hasDownloadIcon = button.querySelector('i.fa-download') || button.querySelector('[class*="download"]');

          if (hasDownloadText || hasDownloadIcon) {
            return button.href;
          }
        }
        return null;
      });

      if (!previewPageUrl) {
        console.log('未找到预览页面链接');
        return null;
      }

      console.log(`预览页面: ${previewPageUrl}`);

      // 3. 访问预览页面
      await this.fetchWithBypass(previewPageUrl);

      // 4. 在预览页面中找到实际的下载按钮
      const downloadPageUrl = await this.page.evaluate(() => {
        // 尝试多个选择器查找下载按钮
        const selectors = [
          '.fileviewer-actions a[target="_blank"]',
          'a.fileviewer-action[href*="easyupload.us"]',
          '.download-link[href*="easyupload.us"]',
          'a[href*="easyupload.us"][target="_blank"]'
        ];

        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.href) {
            // 检查是否是下载按钮（不是分享按钮）
            const text = element.textContent.toLowerCase();
            const hasDownloadIcon = element.querySelector('i.fa-download');
            if (text.includes('download') || hasDownloadIcon) {
              return element.href;
            }
          }
        }

        // 如果没有找到，尝试查找所有easyupload链接
        const allLinks = document.querySelectorAll('a[href*="easyupload.us"]');
        for (const link of allLinks) {
          if (link.href !== window.location.href && !link.href.includes('/preview')) {
            return link.href;
          }
        }

        return null;
      });

      if (!downloadPageUrl) {
        console.log('在预览页面中未找到下载页面链接');
        // 截屏查看页面状态
        await this.page.screenshot({ path: 'preview-page.png' });
        return null;
      }

      console.log(`下载页面: ${downloadPageUrl}`);

      // 5. 访问下载页面获取PDF链接
      await this.fetchWithBypass(downloadPageUrl);

      // 6. 获取PDF链接
      const pdfLink = await this.page.evaluate(() => {
        // 查找PDF下载链接
        const pdfSelectors = [
          '.filebox-download a.download-link',
          '.download-box a[href*=".pdf"]',
          'a[href*=".pdf"][class*="download"]',
          'a[href*=".pdf"]'
        ];

        for (const selector of pdfSelectors) {
          const element = document.querySelector(selector);
          if (element && element.href && element.href.includes('.pdf')) {
            return element.href;
          }
        }

        // 如果没有找到，查找包含download文本的PDF链接
        const allLinks = document.querySelectorAll('a[href*=".pdf"]');
        for (const link of allLinks) {
          const text = link.textContent.toLowerCase();
          if (text.includes('download') || text.includes('pdf')) {
            return link.href;
          }
        }

        return null;
      });

      if (pdfLink) {
        console.log(`PDF链接: ${pdfLink}`);
        return pdfLink;
      } else {
        console.log('在下载页面中未找到PDF链接');
        // 截屏查看页面状态
        await this.page.screenshot({ path: 'download-page.png' });
        return null;
      }

    } catch (error) {
      console.error(`获取下载链接过程中出错: ${error.message}`);
      return null;
    }
  }

  // 或者使用更简洁的版本：
  async getDownloadLinkSimple(url) {
    try {
      console.log(`开始获取PDF链接: ${url}`);

      // 1. 访问预览页面
      await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 2. 获取下载页面URL
      const downloadPageUrl = await this.page.evaluate(() => {
        // 查找下载按钮
        const downloadBtn = document.querySelector('a.fileviewer-action[target="_blank"]');
        return downloadBtn ? downloadBtn.href : null;
      });

      if (!downloadPageUrl) {
        throw new Error('未找到下载页面链接');
      }

      console.log(`下载页面: ${downloadPageUrl}`);

      // 3. 访问下载页面
      await this.page.goto(downloadPageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 4. 获取PDF链接
      const pdfUrl = await this.page.evaluate(() => {
        // 查找下载链接
        const downloadLink = document.querySelector('.filebox-download a.download-link');
        return downloadLink ? downloadLink.href : null;
      });

      if (!pdfUrl) {
        throw new Error('未找到PDF下载链接');
      }

      console.log(`PDF链接: ${pdfUrl}`);
      return pdfUrl;

    } catch (error) {
      console.error(`获取下载链接失败: ${error.message}`);
      return null;
    }
  }

  async processItem({ url, index }) {
    console.log(`处理第 ${index + 1} 个项目: ${url}`);

    const downloadLink = await this.getDownloadLink(url);
    if (!downloadLink) {
      console.log(`未找到下载链接: ${url}`);
      return null;
    }

    const pdfLink = await this.getPdfUrl(downloadLink);
    if (!pdfLink) {
      console.log(`未找到PDF链接: ${downloadLink}`);
      return null;
    }

    const _arr = url.split('/');
    const filename = _arr[_arr.length - 1].replace('_freemagazinespdf_com', '');

    return {
      filename,
      pdflink: pdfLink,
    };
  }

  async getListItems(url) {
    const html = await this.fetchWithBypass(url);
    if (!html) return [];

    const items = await this.page.evaluate(() => {
      const results = [];

      // 查找文章元素
      const articleSelectors = [
        '.generate-columns-container article',
        '.posts-container article',
        '.post-item',
        '.entry',
        'article'
      ];

      let articles = [];
      for (const selector of articleSelectors) {
        articles = document.querySelectorAll(selector);
        if (articles.length > 0) break;
      }

      articles.forEach(article => {
        // 查找标题和链接
        const titleElement = article.querySelector('.entry-title a') ||
          article.querySelector('.post-title a') ||
          article.querySelector('h2 a') ||
          article.querySelector('h3 a') ||
          article.querySelector('a');

        if (!titleElement) return;

        const title = titleElement.textContent.trim();
        const url = titleElement.href;

        // 查找图片
        const imgElement = article.querySelector('.post-image img') ||
          article.querySelector('img') ||
          article.querySelector('.thumbnail img');
        const img = imgElement ? imgElement.src : null;

        results.push({
          title,
          url,
          img,
        });
      });

      return results;
    });

    return items;
  }
}

async function start() {
  const bypasser = new CloudflareBypasser();

  try {
    // 连接MongoDB
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    console.log('成功连接到 MongoDB!');

    const db = client.db('dev');
    const collection = db.collection('magazine');

    // 初始化 Puppeteer
    await bypasser.init();

    // 要抓取的页面列表
    const urls = [
      'https://freemagazinespdf.com/',
      'https://freemagazinespdf.com/page/2/',
      'https://freemagazinespdf.com/page/3/',
      'https://freemagazinespdf.com/page/4/',
      'https://freemagazinespdf.com/page/5/',
    ];

    // 收集所有文章
    const allItems = [];
    for (const url of urls) {
      console.log(`正在获取列表: ${url}`);
      const items = await bypasser.getListItems(url);
      console.log(`找到 ${items.length} 个项目`);
      allItems.push(...items);

      // 添加延迟避免被封锁
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`总共找到 ${allItems.length} 个项目`);

    // 处理每个项目
    for (let index = 0; index < allItems.length; index++) {
      const item = allItems[index];
      console.log(`处理: ${item.title}`);

      try {
        // 检查是否已存在
        const existingDoc = await collection.findOne({ title: item.title });

        if (existingDoc) {
          console.log(`已存在: ${item.title}`);
        } else {
          // 获取PDF链接
          const result = await bypasser.processItem({
            url: item.url,
            index
          });

          if (result) {
            // 插入数据库
            const doc = {
              filename: result.filename,
              title: item.title,
              pdflink: result.pdflink,
              img: item.img,
              createdAt: new Date()
            };

            const insertResult = await collection.insertOne(doc);
            console.log(`插入成功，文档 ID: ${insertResult.insertedId}`);

            // 发送消息（可选）
            if (sendMessage) {
              await sendMessage(`[${item.title}](${result.pdflink})`, item.img);
            }
          }
        }

        // 添加随机延迟避免被封锁
        const delay = Math.floor(Math.random() * 3000) + 1000;
        await new Promise(resolve => setTimeout(resolve, delay));

      } catch (error) {
        console.error(`处理项目失败 ${item.title}:`, error.message);
      }
    }

  } catch (error) {
    console.error('启动失败:', error);
  } finally {
    // 关闭资源
    if (bypasser) {
      await bypasser.close();
    }
    if (client) {
      await client.close();
    }
    console.log('程序结束');
  }
}

// 错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
});

// 运行程序
start();