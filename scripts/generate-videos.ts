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
const TMP_DIR = path.resolve(process.cwd(), '.cache/raw_videos');
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

interface VideoJob {
  filename: string;
  prompt: string;
}

// Strictly capped at 3 short 4s 720p silent flash loops to minimize ARK cost
const JOBS: VideoJob[] = [
  {
    filename: 'lobby-velvet.mp4',
    prompt:
      'Overhead angled cinematic shot of a luxury dark emerald green velvet tabletop salon lit by warm flickering golden candlelight, subtle floating golden dust bokeh particles, slow smooth atmospheric camera drift, no people, no text, upscale dark fantasy lounge.',
  },
  {
    filename: 'night-gothic.mp4',
    prompt:
      'Atmospheric gothic stained-glass castle hall under a glowing silver-blue moonlit mist, warm flickering brass candelabras casting soft shadows on stone walls, slow drifting fog, dark mystery board game mood, no people, no text.',
  },
  {
    filename: 'casino-party.mp4',
    prompt:
      'Upscale Art-Deco Monte Carlo velvet gaming lounge background with warm golden chandelier bokeh and subtle emerald and ruby neon ambient reflections, smooth gentle camera float, luxury party vibe, no people, no text.',
  },
];

const CANDIDATE_MODELS = [
  'doubao-seedance-2-0-fast-260128',
  'doubao-seedance-2-0-mini-260615',
  'doubao-seedance-2-5-260628',
];

async function createSeedanceTask(prompt: string): Promise<{ id: string; model: string }> {
  for (const model of CANDIDATE_MODELS) {
    const createRes = await fetch('https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ARK_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        content: [{ type: 'text', text: prompt }],
        ratio: '16:9',
        resolution: '720p',
        duration: 4,
        generate_audio: false,
      }),
    });

    if (createRes.ok) {
      const data = (await createRes.json()) as { id: string };
      return { id: data.id, model };
    }
    const errText = await createRes.text();
    if (createRes.status === 404 && errText.includes('ModelNotOpen')) {
      console.log(`[info] Model ${model} not activated, trying next candidate...`);
      continue;
    }
    throw new Error(`Seedance create failed (${createRes.status}): ${errText}`);
  }
  throw new Error('No candidate Seedance models are activated on this account.');
}

async function createAndDownloadVideo(job: VideoJob): Promise<void> {
  const finalPath = path.join(OUT_DIR, job.filename);
  if (fs.existsSync(finalPath) && fs.statSync(finalPath).size > 10_000) {
    console.log(`[skip] ${job.filename} already exists (${fs.statSync(finalPath).size} bytes)`);
    return;
  }

  console.log(`[create] Submitting Seedance task for ${job.filename}...`);
  const created = await createSeedanceTask(job.prompt);
  console.log(`[poll] Task ${created.id} (${created.model}) queued for ${job.filename}`);

  const startedAt = Date.now();
  while (Date.now() - startedAt < 240_000) {
    await new Promise((r) => setTimeout(r, 5000));
    const pollRes = await fetch(
      `https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/${created.id}`,
      {
        headers: { Authorization: `Bearer ${ARK_API_KEY}` },
      },
    );
    if (!pollRes.ok) {
      throw new Error(`Seedance poll HTTP ${pollRes.status}`);
    }
    const statusObj = (await pollRes.json()) as {
      status: string;
      content?: { video_url?: string };
      error?: unknown;
      usage?: { total_tokens?: number };
    };
    if (statusObj.status === 'succeeded' && statusObj.content?.video_url) {
      console.log(
        `[download] ${job.filename} succeeded (tokens=${statusObj.usage?.total_tokens ?? '?'})`,
      );
      const rawPath = path.join(TMP_DIR, `raw-${job.filename}`);
      const vidRes = await fetch(statusObj.content.video_url);
      if (!vidRes.ok) throw new Error(`Failed downloading video URL: ${vidRes.status}`);
      fs.writeFileSync(rawPath, Buffer.from(await vidRes.arrayBuffer()));

      execFileSync(
        'ffmpeg',
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
          '26',
          '-preset',
          'fast',
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart',
          finalPath,
        ],
        { stdio: 'inherit' },
      );
      fs.unlinkSync(rawPath);
      console.log(`[done] Saved compressed loop ${finalPath} (${fs.statSync(finalPath).size} bytes)`);
      return;
    }
    if (statusObj.status === 'failed' || statusObj.status === 'cancelled') {
      throw new Error(`Seedance task ${created.id} ${statusObj.status}: ${JSON.stringify(statusObj.error)}`);
    }
  }
  throw new Error(`Seedance task ${created.id} timed out after 240s`);
}

async function main() {
  for (const job of JOBS) {
    await createAndDownloadVideo(job);
  }
  console.log('All Seedance stage backdrop loops ready.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
