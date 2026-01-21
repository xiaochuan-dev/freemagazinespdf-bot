const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// 使用隐身插件
puppeteer.use(StealthPlugin());

async function bypassCloudflare() {
  console.log('启动浏览器绕过Cloudflare...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });
  
  const page = await browser.newPage();
  
  try {
    // 关键：设置真实的用户代理
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // 设置额外的HTTP头
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br'
    });
    
    // 注入防检测代码
    await page.evaluateOnNewDocument(() => {
      // 隐藏webdriver属性
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    
    console.log('正在访问网站...');
    
    // 访问页面
    await page.goto('https://freemagazinespdf.com', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // 等待一下，让页面加载
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 检查是否成功绕过
    const title = await page.title();
    console.log('页面标题:', title);
    
    const isBlocked = await page.evaluate(() => {
      return document.title.includes('Just a moment') || 
             document.body.innerText.includes('Checking your browser');
    });
    
    if (isBlocked) {
      console.log('⚠️ 仍然被Cloudflare阻挡');
      
      // 尝试点击可能的验证按钮
      await page.evaluate(() => {
        const buttons = document.querySelectorAll('button, input[type="submit"]');
        for (let btn of buttons) {
          const text = (btn.textContent || btn.value || '').toLowerCase();
          if (text.includes('verify') || text.includes('continue')) {
            btn.click();
            return;
          }
        }
      });
      
      // 再等待一下
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.log('✅ 成功绕过Cloudflare！');
    }
    
    // 获取最终内容
    const content = await page.content();
    console.log('页面内容长度:', content.length);
    
    // 保存结果
    await page.screenshot({ path: 'result.png' });
    console.log('截图已保存: result.png');
    
    await browser.close();
    
  } catch (error) {
    console.error('错误:', error.message);
    await browser.close();
  }
}

// 安装依赖后运行
// npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
bypassCloudflare();