// Servidor devexec standalone — puerto 3002
// Ejecutar con: node devexec-server.js
const http = require('http');
const { execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const PORT = 3002;
const CWD = __dirname;

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(404); res.end('{}'); return; }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const { code } = JSON.parse(body);
      if (!code) { res.end(JSON.stringify({ ok: false, error: 'Falta code' })); return; }

      // Escribir en tmp y ejecutar
      const tmpFile = path.join(os.tmpdir(), 'devexec_' + Date.now() + '.js');
      fs.writeFileSync(tmpFile, code, 'utf8');

      try {
        const output = execSync('node "' + tmpFile + '"', {
          cwd: CWD,
          timeout: 30000,
          encoding: 'utf8',
        });
        fs.unlinkSync(tmpFile);
        res.end(JSON.stringify({ ok: true, output: output.toString() }));
      } catch (e) {
        try { fs.unlinkSync(tmpFile); } catch {}
        res.end(JSON.stringify({ ok: false, error: e.message, output: (e.stdout || '') + (e.stderr || '') }));
      }
    } catch (e) {
      res.end(JSON.stringify({ ok: false, error: 'JSON invalido: ' + e.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log('[devexec] Servidor corriendo en http://localhost:' + PORT);
  console.log('[devexec] CWD:', CWD);
});
