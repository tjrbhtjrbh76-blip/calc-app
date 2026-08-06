/**
 * حلبة الأرقام — خادم الشبكة الداخلية
 * ─────────────────────────────────────
 * التشغيل:
 *   npm install ws
 *   node server.js
 *
 * ثم افتح المتصفح على رابط الخادم مباشرة
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

// ── HTTP: يخدم index.html ──────────────────────────────────────────────────
const httpServer = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    const file = path.join(__dirname, 'index.html');
    if (!fs.existsSync(file)) {
      res.writeHead(404); res.end('index.html غير موجود بجانب server.js'); return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(file).pipe(res);
  } else {
    res.writeHead(404); res.end('Not found');
  }
});

// ── WebSocket ──────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

/** @type {Map<string, {ws, name, value, expr, id}>} */
const players = new Map();

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}

function sendAllPlayers(ws) {
  const list = [];
  players.forEach(p => list.push({ id: p.id, name: p.name, value: p.value, expr: p.expr }));
  ws.send(JSON.stringify({ type: 'snapshot', players: list }));
}

wss.on('connection', (ws) => {
  let playerId = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {

      case 'join': {
        playerId = msg.id;
        players.set(playerId, { ws, id: playerId, name: msg.name, value: 0, expr: '' });
        console.log(`✅ انضم: ${msg.name} (${playerId})`);

        // أرسل للقادم الجديد لائحة الكل أولاً
        sendAllPlayers(ws);

        // أخبر الجميع بالقادم الجديد
        broadcast({ type: 'join', id: playerId, name: msg.name, value: 0, expr: '' });
        break;
      }

      case 'calc': {
        if (!playerId || !players.has(playerId)) return;
        const p = players.get(playerId);
        p.value = msg.value;
        p.expr  = msg.expr;
        broadcast({ type: 'update', id: playerId, name: p.name, value: msg.value, expr: msg.expr });
        break;
      }
    }
  });

  ws.on('close', () => {
    if (playerId && players.has(playerId)) {
      const name = players.get(playerId).name;
      players.delete(playerId);
      console.log(`❌ غادر: ${name}`);
      broadcast({ type: 'leave', id: playerId });
    }
  });
});

// ── Start ──────────────────────────────────────────────────────────────────
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('\n🧮  حلبة الأرقام — الخادم يعمل\n');
  console.log(`   http://localhost:${PORT}\n`);
});
