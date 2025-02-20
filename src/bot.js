const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = '-1002356410594';

async function getFiles() {
  const url =
    'https://registry.npmjs.org/@xiaochuan-dev/freemagazinespdf/latest';
  const r = await fetch(url);
  const data = await r.json();

  const { newPdf } = data;

  const baseUrl = `https://unpkg.com/@xiaochuan-dev/freemagazinespdf`;

  const newArr = newPdf.map((v) => {
    const { title, version, filename } = v;

    const url = `${baseUrl}@${version}/${filename}`;
    return {
      title,
      url,
    };
  });
  return newArr;
}


async function sendMessage(text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const params = {
    chat_id: CHAT_ID,
    text: text,
    parse_mode: 'Markdown',
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const result = await response.json();
    console.log('消息发送成功:', result);
  } catch (error) {
    console.error('发送消息失败:', error);
  }
}

async function start() {
  const files = await getFiles();

  for (const file of files) {
    const { url, title } = file;

    await sendMessage(`[${title}](${url})`);
  }
}

start();
