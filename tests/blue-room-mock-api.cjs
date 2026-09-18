// Manual UI fixture: node tests/blue-room-mock-api.cjs (localhost:3000).
// In-memory only. No SDKs, credentials, MongoDB, or provider calls.
const http = require('node:http');
let session = null;
let messages = [];
http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  const send = (data, status = 200) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  if (req.method === 'OPTIONS') return send({});
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/healthz') return send({ ok: true });
  if (path === '/blue-room/sessions' && req.method === 'POST') {
    let body = ''; for await (const chunk of req) body += chunk;
    const input = JSON.parse(body);
    session = { id: 'mock-session', title: 'Sleeper train · UI fixture', emoji: '🚃', contextPrompt: input.contextPrompt,
      status: 'pending', totalTurns: 10, totalMessages: 20, completedMessages: 0, createdAt: new Date().toISOString(),
      participants: { claude: { name: 'Margit', model: 'mock', roleIndex: input.person1 === 'openai' ? 2 : 1 },
        openai: { name: 'Jules', model: 'mock', roleIndex: input.person1 === 'openai' ? 1 : 2 } } };
    messages = []; return send({ session, messages }, 201);
  }
  if (path === '/blue-room/sessions') return send({ sessions: session ? [session] : [] });
  if (!session) return send({ error: 'not_found' }, 404);
  if (path.includes('/personas/')) {
    const speaker = path.split('/').pop();
    return send({ persona: { name: session.participants[speaker].name, brief: `I'm ${session.participants[speaker].name}. This is a mock private brief, visible only to the observer.\n\nI am travelling overnight and wondering what tomorrow will bring.` } });
  }
  if (path.endsWith('/turn')) {
    await new Promise(resolve => setTimeout(resolve, 350));
    const index = messages.length;
    if (index === 20) return send({ session, advanced: false, reason: 'completed' });
    const message = { turnIndex: index, speaker: index % 2 ? 'openai' : 'claude',
      text: index % 2 ? 'Oui, je vais à Berlin. And you?\n\n🌀 <script>plain text, not executable</script>' : 'Is this seat free? The lights outside are already disappearing. 🚃', createdAt: new Date().toISOString() };
    messages.push(message); session.completedMessages = messages.length;
    session.status = messages.length === 20 ? 'completed' : 'running';
    return send({ session, message, advanced: true, reason: 'advanced' });
  }
  return send({ session, messages });
}).listen(3000, '127.0.0.1', () => console.log('Mock-only Blue Room API on 127.0.0.1:3000'));
