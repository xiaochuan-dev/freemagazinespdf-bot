const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");

puppeteer.use(StealthPlugin());

async function getItems(page, url) {
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 5000
  });
  await page.waitForTimeout(5000)
  await page.screenshot({ path: 'testresult.png', fullPage: true })

  const itemElements = await page.$$(".generate-columns-container article");
  const items = [];
  console.log(itemElements);

  return {
    items,
    nextPageUrl,
  };
}

(async () => {
  /**
   * @type {import('puppeteer-core').Browser}
   */
  const browser = await puppeteer.launch({
    channel: "chrome",
    executablePath: '/usr/bin/chromium-browser', // 或 '/usr/bin/google-chrome'
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: 'new',
    pipe: true,
    // headless: false
  });
  const page = await browser.newPage();
  const res = [];
  page.on('error', error => {
            console.log('页面错误:', error.message);
        });
        
        page.on('pageerror', error => {
            console.log('页面脚本错误:', error.message);
        });

  getItems(page, 'https://freemagazinespdf.com/');

  await browser.close();
})();