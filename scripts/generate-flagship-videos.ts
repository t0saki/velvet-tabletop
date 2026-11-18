import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadLocalEnv } from '../src/server/services/envLoader.js';

loadLocalEnv(process.cwd());

const ARK_API_KEY = process.env.ARK_API_KEY;
if (!ARK_API_KEY) {
  console.error('Missing ARK_API_KEY in .env.local');
  process.exit(1);
}

const OUT_DIR = path.resolve(process.cwd(), 'public/videos');
const TMP_DIR = path.resolve(process.cwd(), '.cache/raw_flagship_videos');
const FFMPEG_BIN = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

interface VideoJob {
  filename: string;
  prompt: string;
}

// Strictly capped at 7 flagship Seedance 2.5 5s 720p silent stage loops
const JOBS: VideoJob[] = [
  {
    filename: 'lobby-velvet-25.mp4',
    prompt:
      'Luxury dark-emerald velvet tabletop gaming salon at night, warm crystal chandelier reflections, flickering golden beeswax candles, subtle floating golden bokeh dust particles, slow smooth cinematic camera drift, no people, no text.',
  },
  {
    filename: 'stage-avalon.mp4',
    prompt:
      'Medieval Arthurian carved oak and royal-blue velvet Round Table inside a candlelit stained-glass hall, an ornate golden Holy Grail radiating soft ethereal light at center, drifting warm embers, slow cinematic drift, no people, no text.',
  },
  {
    filename: 'stage-werewolf.mp4',
    prompt:
      'Moody gothic stone castle manor courtyard at midnight under a dramatic crimson-and-silver lunar eclipse, glowing amber brass lantern in swirling cold mist, ominous dark fantasy atmosphere, slow camera float, no people, no text.',
  },
  {
    filename: 'stage-texas.mp4',
    prompt:
      'High-roller Monte Carlo emerald velvet poker table under a warm overhead spotlight, gleaming obsidian and burnished gold chip stacks, subtle warm chandelier lounge bokeh, slow smooth luxury camera glide, no people, no text.',
  },
  {
    filename: 'stage-monopoly.mp4',
    prompt:
      'Art-Deco gleaming golden and emerald metropolis night skyline viewed from an upscale penthouse terrace, sweeping golden searchlights and shimmering skyscraper windows, luxury roaring-twenties atmosphere, slow camera drift, no people, no text.',
  },
  {
    filename: 'stage-sketch.mp4',
    prompt:
      'Vibrant upscale midnight neon art salon, floating gilded picture frames and soft glowing pastel paint dust particles drifting in warm studio lighting, creative glamorous party lounge atmosphere, slow camera drift, no people, no text.',
  },
  {
    filename: 'stage-undercover.mp4',
    prompt:
      'Opulent Venetian midnight masquerade ballroom with deep plum velvet drapes, crystal chandelier candlelight, ornate gold-filigree masquerade masks resting on dark marble, mysterious romantic ambiance, slow camera float, no people, no text.',
  },
];

async function generateVideo(job: VideoJob): Promise<void> {
  const finalPath = path.join(OUT_DIR, job.filename);
  if (fs.existsSync(finalPath) && fs.statSync(finalPath).size > 50_000) {
    console.log(`[skip] ${job.filename} exists (${fs.statSync(finalPath).size} bytes)`);
    return;
  }

  console.log(`[create] Submitting Seedance 2.5 task for ${job.filename}...`);
  const createRes = await fetch('https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ARK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'doubao-seedance-2-5-260628',
      content: [{ type: 'text', text: job.prompt }],
      ratio: '16:9',
      resolution: '720p',
      duration: 5,
      generate_audio: false,
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Seedance 2.5 create failed (${createRes.status}): ${errText}`);
  }
  const created = (await createRes.json()) as { id: string };
  console.log(`[poll] ${created.id} -> ${job.filename}`);

  const startedAt = Date.now();
  while (Date.now() - startedAt < 300_000) {
    await new Promise((r) => setTimeout(r, 5000));
    const pollRes = await fetch(
      `https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/${created.id}`,
      {
        headers: { Authorization: `Bearer ${ARK_API_KEY}` },
      },
    );
    if (!pollRes.ok) throw new Error(`Poll HTTP ${pollRes.status}`);
    const statusObj = (await pollRes.json()) as {
      status: string;
      content?: { video_url?: string };
      error?: unknown;
      usage?: { total_tokens?: number };
    };
    if (statusObj.status === 'succeeded' && statusObj.content?.video_url) {
      console.log(`[download] ${job.filename} succeeded (tokens=${statusObj.usage?.total_tokens ?? '?'})`);
      const rawPath = path.join(TMP_DIR, `raw-${job.filename}`);
      const vidRes = await fetch(statusObj.content.video_url);
      if (!vidRes.ok) throw new Error(`Download HTTP ${vidRes.status}`);
      fs.writeFileSync(rawPath, Buffer.from(await vidRes.arrayBuffer()));

      execFileSync(
        FFMPEG_BIN,
        [
          '-y',
          '-i',
          rawPath,
          '-an',
          '-vf',
          'scale=1280:720',
          '-c:v',
          'libx264',
          '-crf',
          '25',
          '-preset',
          'fast',
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart',
          finalPath,
        ],
        { stdio: 'ignore' },
      );
      fs.unlinkSync(rawPath);
      console.log(`[done] ${job.filename} (${fs.statSync(finalPath).size} bytes)`);
      return;
    }
    if (statusObj.status === 'failed' || statusObj.status === 'cancelled') {
      throw new Error(`Task ${created.id} ${statusObj.status}: ${JSON.stringify(statusObj.error)}`);
    }
  }
  throw new Error(`Task ${created.id} timed out`);
}

async function main() {
  for (let i = 0; i < JOBS.length; i += 3) {
    await Promise.all(JOBS.slice(i, i + 3).map((j) => generateVideo(j)));
  }
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  console.log('All 7 Seedance 2.5 stage videos ready.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
