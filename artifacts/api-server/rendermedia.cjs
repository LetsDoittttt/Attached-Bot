const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
(async () => {
  const client = new TelegramClient(
    new StringSession('1AQAOMTQ5LjE1NC4xNzUuNTQBuzolMKzxsfjT49i5beIAopfRaPfknVGcYzPTXIS6F6D4uw0fUk5ISBGxqE/rS4nV5gHm9QlynhQtfoeFO1mXJOYsDFZSDFIaCBHr/ABwTr51QKWmkiymGIeX+fJmyivyZwb+1kxRw3ZbNbE45RAS3rJ1yM/V76g9qJsob/jxL41RJBigHedWSt3X7eT8A1jl9h86Hefi2yRv/Op6vHHbflkpLVCvW2L6OATYNhN8CaTOKBchcUec5jea+vT0QNJejkV8HHTlCh6oJgE2IVNZECh/suqZhZISsT8F6IIfhtpn9W7EssT7cI8DCydc28UJLzLsAZp8O0HgczLZe4GsHek='),
    37071709, 'c6a0b305d4b5eae76f01103133acbd8d', { connectionRetries: 5 }
  );
  await client.connect();
  const msgs = await client.getMessages(-1003924753309, { ids: [3217] });
  const msg = msgs[0];
  const url = 'https://link-center.net/230558/DLHTzrLjTayx';
  const res = await fetch('https://attached-bot.onrender.com/api/bypass/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  const data = await res.json();
  console.log('Link result:', data.finalUrl);
  if (data.success && msg.media) {
    console.log('Sending media download request to Render...');
    const res2 = await fetch('https://attached-bot.onrender.com/api/process-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: 3217, channelId: -1003924753309, finalUrl: data.finalUrl })
    });
    console.log('Media response:', await res2.text());
  }
  await client.disconnect();
  process.exit(0);
})();
