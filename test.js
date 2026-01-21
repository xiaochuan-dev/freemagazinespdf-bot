const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// 使用 stealth 插件
puppeteer.use(StealthPlugin());

async function bypassCloudflare() {
  const browser = await puppeteer.launch({
    headless: 'new', // 或 true，'new' 是新版本的无头模式
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--single-process', // 在某些环境中可能需要
    ]
  });

  const page = await browser.newPage();
  
  // 设置视口大小
  await page.setViewport({ width: 1366, height: 768 });
  
  // 设置语言偏好
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
  });
  
  // 覆盖 webdriver 属性
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });
  });
  
  // 覆盖 chrome 属性
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'chrome', {
      get: () => ({
        app: {
          isInstalled: false
        },
        webstore: {},
        runtime: {}
      })
    });
  });
  
  // 覆盖 permissions 属性
  await page.evaluateOnNewDocument(() => {
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
  });
  
  // 添加随机鼠标移动
  await page.evaluateOnNewDocument(() => {
    window.addEventListener('load', () => {
      setTimeout(() => {
        document.dispatchEvent(new MouseEvent('mousemove', {
          clientX: Math.random() * 800,
          clientY: Math.random() * 600
        }));
      }, 1000);
    });
  });

  // 导航到目标页面
  await page.goto('https://freemagazinespdf.com', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  // 等待可能的验证
  await page.waitForTimeout(5000);
  
  // 检查是否还有验证
  const hasChallenge = await page.evaluate(() => {
    return document.body.innerHTML.includes('cf-chl-w') || 
           document.body.innerHTML.includes('challenge-form') ||
           window.location.href.includes('challenge');
  });
  
  if (hasChallenge) {
    console.log('可能需要手动验证...');
    // 这里可以添加自动处理逻辑或等待用户手动完成
  }

  // 获取页面内容
  const content = await page.content();
  console.log('页面加载成功', content);
  
  // 继续其他操作...
  await browser.close();
}

bypassCloudflare().catch(console.error);