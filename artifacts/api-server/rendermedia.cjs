const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram');

(async () => {
  const client = new TelegramClient(
    new StringSession('1AQAOMTQ5LjE1NC4xNzUuNTQBuzolMKzxsfjT49i5beIAopfRaPfknVGcYzPTXIS6F6D4uw0fUk5ISBGxqE/rS4nV5gHm9QlynhQtfoeFO1mXJOYsDFZSDFIaCBHr/ABwTr51QKWmkiymGIeX+fJmyivyZwb+1kxRw3ZbNbE45RAS3rJ1yM/V76g9qJsob/1kxRw3ZbNbE45RAS3rJ1yM/V76g9qJsob/jxL41RJBigHedWSt3X7eT8A1jl9h86Hefi2yRv/Op6vHHbflkpLVCvW2L6OATYNhN8CaTOKBchcUec5jea+vT0QNJejkV8HHTlCh6oJgE2IVNZECh/suqZhZISsT8F6IIfhtpn9W7EssT7cI8DCydc28UJLzLsAZp8O0HgczLZe4GsHek='),
    37071709, 'c6a0b305d4b5eae76f01103133acbd8d', { connectionRetries: 5 }
  );

  await client.connect();
  console.log('Connected!');

  const msgs = await client.getMessages(-1003924753309, { limit: 10 });
  const msg = msgs.find(m => !!m.media);

  if (!msg) {
    console.log('No media found.');
    await client.disconnect();
    process.exit(0);
  }

  console.log('Found message ID:', msg.id, '- media type:', msg.media?.className);

  // Get original attributes and mime type from source
  const doc = msg.media?.document;
  const mimeType = doc?.mimeType || 'video/mp4';
  const originalAttrs = doc?.attributes || [];

  console.log('MIME type:', mimeType);
  console.log('Attributes:', JSON.stringify(originalAttrs.map(a => a.className)));

  const buffer = await client.downloadMedia(msg, { workers: 4 });

  if (buffer && buffer.length > 0) {
    console.log('Downloaded:', buffer.length, 'bytes - sending as video...');
    const inputPeer = await client.getInputEntity(-1003958166509);

    await client.sendFile(inputPeer, {
      file: buffer,
      caption: msg.text || '',
      forceDocument: false,
      mimeType: mimeType,
      attributes: originalAttrs,
      supportsStreaming: true,
    });

    console.log('Done!');
  } else {
    console.log('Failed - buffer empty.');
  }

  await client.disconnect();
  process.exit(0);
})();
