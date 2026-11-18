import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import type { VoiceRolePreset } from '../shared/voiceClips.js';
import { loadLocalEnv } from './services/envLoader.js';
import { synthesizeDoubaoSpeech } from './services/doubaoTts.js';
import { generateQrDataUrl, getLanNetworkInfo } from './network.js';
import { RoomManager } from './roomManager.js';

loadLocalEnv(process.cwd());

export interface CreatedServer {
  app: express.Express;
  httpServer: http.Server;
  io: SocketIOServer;
  roomManager: RoomManager;
  port: number;
  close: () => Promise<void>;
}

export async function createAppServer(options?: {
  port?: number;
  disableVite?: boolean;
}): Promise<CreatedServer> {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
    maxHttpBufferSize: 1_000_000,
  });

  const roomManager = new RoomManager(io);
  roomManager.start();

  io.on('connection', (socket) => {
    roomManager.registerSocketHandlers(socket);
  });

  let activePort = options?.port ?? Number(process.env.PORT || 3210);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, time: Date.now() });
  });

  app.get('/api/network', (_req, res) => {
    res.json(getLanNetworkInfo(activePort));
  });

  app.get('/api/qr', async (req, res) => {
    const url = String(req.query.url || getLanNetworkInfo(activePort).primaryUrl);
    try {
      const dataUrl = await generateQrDataUrl(url);
      res.json({ url, dataUrl });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  const ttsCacheDir = path.resolve(process.cwd(), '.cache/tts');
  fs.mkdirSync(ttsCacheDir, { recursive: true });

  app.post('/api/tts', async (req, res) => {
    const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const lang = req.body?.lang === 'en' ? 'en' : 'zh';
    const role: VoiceRolePreset =
      typeof req.body?.role === 'string'
        ? (req.body.role as VoiceRolePreset)
        : lang === 'en'
          ? 'en_host_female'
          : 'zh_host_female';

    if (!rawText || rawText.length > 90) {
      res.status(400).json({ error: 'Text must be 1..90 chars' });
      return;
    }

    const hash = crypto
      .createHash('sha256')
      .update(`${role}:${rawText}`)
      .digest('hex')
      .slice(0, 24);
    const cacheFile = path.join(ttsCacheDir, `${hash}.mp3`);

    if (fs.existsSync(cacheFile) && fs.statSync(cacheFile).size > 512) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.send(fs.readFileSync(cacheFile));
      return;
    }

    if (!process.env.DOUBAO_API_KEY) {
      res.status(503).json({ error: 'TTS unavailable offline' });
      return;
    }

    try {
      const out = await synthesizeDoubaoSpeech({ text: rawText, role });
      fs.writeFileSync(cacheFile, out.audio);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.send(out.audio);
    } catch (err) {
      res.status(503).json({ error: String(err) });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  const publicDir = path.resolve(process.cwd(), 'public');
  const distClientDir = path.resolve(process.cwd(), 'dist/client');

  if (!isProd && !options?.disableVite) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    if (fs.existsSync(publicDir)) {
      app.use(express.static(publicDir, { maxAge: '7d' }));
    }
    if (fs.existsSync(distClientDir)) {
      app.use(
        express.static(distClientDir, {
          maxAge: '7d',
          setHeaders: (res, filePath) => {
            if (filePath.endsWith('.html')) {
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            }
          },
        }),
      );
      app.get('*', (_req, res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(path.join(distClientDir, 'index.html'));
      });
    }
  }

  const listenOnPort = (portToTry: number): Promise<number> =>
    new Promise((resolve, reject) => {
      const onErr = (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && portToTry !== 0 && options?.port === undefined) {
          httpServer.off('error', onErr);
          listenOnPort(portToTry + 1).then(resolve, reject);
        } else {
          reject(err);
        }
      };
      httpServer.once('error', onErr);
      httpServer.listen(portToTry, '0.0.0.0', () => {
        httpServer.off('error', onErr);
        const addr = httpServer.address();
        const resolvedPort = typeof addr === 'object' && addr ? addr.port : portToTry;
        activePort = resolvedPort;
        resolve(resolvedPort);
      });
    });

  const boundPort = await listenOnPort(activePort);

  return {
    app,
    httpServer,
    io,
    roomManager,
    port: boundPort,
    close: async () => {
      roomManager.stop();
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}

// Direct CLI entrypoint detection
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('server/index.ts') ||
    process.argv[1].endsWith('server/index.js'));

if (isDirectRun) {
  createAppServer()
    .then((srv) => {
      const netInfo = getLanNetworkInfo(srv.port);
      console.log('\n======================================================');
      console.log('  天鹅绒桌游盒 · VELVET TABLETOP LAN SERVER READY');
      console.log('======================================================');
      console.log(`  Local:   http://localhost:${srv.port}`);
      console.log(`  TV Mode: http://localhost:${srv.port}/?mode=tv`);
      for (const a of netInfo.addresses) {
        console.log(`  LAN (${a.name}): ${a.url}`);
      }
      console.log('======================================================\n');
    })
    .catch((err) => {
      console.error('Failed to start Velvet Tabletop server:', err);
      process.exit(1);
    });
}
