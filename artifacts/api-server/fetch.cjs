const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
(async () => {
  const client = new TelegramClient(
    new StringSession('1AQAOMTQ5LjE1NC4xNzUuNTQBuzolMKzxsfjT49i5beIAopfRaPfknVGcYzPTXIS6F6D4uw0fUk5ISBGxqE/rS4nV5gHm9QlynhQtfoeFO1mXJOYsDFZSDFIaCBHr/ABwTr51QKWmkiymGIeX+fJmyivyZwb+1kxRw3ZbNbE45RAS3rJ1yM/V76g9qJsob/jxL41RJBigHedWSt3X7eT8A1jl9h86Hefi2yRv/Op6vHHbflkpLVCvW2L6OATYNhN8CaTOKBchcUec5jea+vT0QNJejkV8HHTlCh6oJgE2IVNZECh/suqZhZISsT8F6IIfhtpn9W7EssT7cI8DCydc28UJLzLsAZp8O0HgczLZe4GsHek='),
    37071709,
    'c6a0b305d4b5eae76f01103133acbd8d',
    { connectionRetries: 5 }
  );
  await client.connect();
  try {
    await client.invoke(new (require('telegram/tl').Api.messages.ImportChatInvite)({ hash: 'b_RhDucMusIyZTE0' }));
  } catch(e) { console.log('Already joined or error:', e.message); }
  const messages = await client.getMessages(-1003924753309, { limit: 10 });
  for (const msg of messages) {
    if (msg.text == null || msg.text === '') continue;
    const match = msg.text.match(/https?:\/\/[^\s]+/);
    if (match == null) continue;
    console.log('Found link:', match[0]);
    const res = await fetch('https://attached-bot.onrender.com/api/bypass/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: match[0] })
    });
    const data = await res.json();
    console.log('Result:', JSON.stringify(data));
  }
  await client.disconnect();
  process.exit(0);
})();
