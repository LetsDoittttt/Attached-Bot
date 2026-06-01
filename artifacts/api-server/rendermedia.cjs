const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram/tl');
(async () => {
  const client = new TelegramClient(
    new StringSession('1AQAOMTQ5LjE1NC4xNzUuNTQBuzolMKzxsfjT49i5beIAopfRaPfknVGcYzPTXIS6F6D4uw0fUk5ISBGxqE/rS4nV5gHm9QlynhQtfoeFO1mXJOYsDFZSDFIaCBHr/ABwTr51QKWmkiymGIeX+fJmyivyZwb+1kxRw3ZbNbE45RAS3rJ1yM/V76g9qJsob/jxL41RJBigHedWSt3X7eT8A1jl9h86Hefi2yRv/Op6vHHbflkpLVCvW2L6OATYNhN8CaTOKBchcUec5jea+vT0QNJejkV8HHTlCh6oJgE2IVNZECh/suqZhZISsT8F6IIfhtpn9W7EssT7cI8DCydc28UJLzLsAZp8O0HgczLZe4GsHek='),
    37071709, 'c6a0b305d4b5eae76f01103133acbd8d', { connectionRetries: 5 }
  );
  await client.connect();
  const msgs = await client.getMessages(-1003924753309, { limit: 10 });
  const msg = msgs.find(m => m.media && m.media.className === 'MessageMediaDocument');
  if (!msg) { console.log('No media found'); await client.disconnect(); process.exit(0); }
  console.log('ID:', msg.id, 'size:', Number(msg.media.document.size)/1024/1024, 'MB');
  const buffer = await client.downloadMedia(msg, {});
  if (!buffer || buffer.length === 0) { console.log('Download failed'); process.exit(1); }
  console.log('Downloaded:', buffer.length, 'bytes');
  const inputPeer = await client.getInputEntity(-1003958166509);
  const videoAttr = new Api.DocumentAttributeVideo({
    duration: msg.media.document.attributes.find(a => a.className === 'DocumentAttributeVideo')?.duration || 0,
    w: msg.media.document.attributes.find(a => a.className === 'DocumentAttributeVideo')?.w || 1280,
    h: msg.media.document.attributes.find(a => a.className === 'DocumentAttributeVideo')?.h || 720,
    supportsStreaming: true,
  });
  const fs = require('fs');
  fs.writeFileSync('/tmp/video.mp4', buffer);
  const urlMatch = (msg.text || '').match(/https?:\/\/[^\s]+/);
  let caption = msg.text || '';
  if (urlMatch) {
    const bypassRes = await fetch('https://attached-bot.onrender.com/api/bypass/test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlMatch[0] })
    });
    const bypassData = await bypassRes.json();
    if (bypassData.finalUrl) {
      caption = (msg.text || '').replace(urlMatch[0], bypassData.finalUrl);
    }
  }
  await client.sendFile(inputPeer, {
    file: '/tmp/video.mp4',
    caption,
    forceDocument: false,
    attributes: [videoAttr],
  });
  fs.unlinkSync('/tmp/video.mp4');
  console.log('Sent!');
  await client.disconnect();
  process.exit(0);
})();