import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadLocalEnv } from '../src/server/services/envLoader.js';
import { VOICE_CLIP_CATALOG } from '../src/shared/voiceClips.js';
import { generateSeedAudioBgm, synthesizeDoubaoSpeech } from '../src/server/services/doubaoTts.js';

loadLocalEnv(process.cwd());

const VOICES_DIR = path.resolve(process.cwd(), 'public/audio/voices');
const BGM_DIR = path.resolve(process.cwd(), 'public/audio/bgm');
const TMP_DIR = path.resolve(process.cwd(), '.cache/raw_audio');

fs.mkdirSync(path.join(VOICES_DIR, 'zh'), { recursive: true });
fs.mkdirSync(path.join(VOICES_DIR, 'en'), { recursive: true });
fs.mkdirSync(BGM_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

interface BgmSpec {
  filename: string;
  prompt: string;
  fallbackFilter: string;
}

const BGM_SPECS: BgmSpec[] = [
  {
    filename: 'lobby.mp3',
    prompt:
      '20秒纯音乐无人声，优雅微醺的高级爵士酒廊背景配乐，温暖原声钢琴与轻柔大提琴低音拨弦，低饱和度柔和氛围循环，适合高端桌游大厅。',
    fallbackFilter:
      'aevalsrc=0.08*sin(2*PI*220*t)+0.05*sin(2*PI*277.18*t)+0.04*sin(2*PI*329.63*t):s=24000:d=16',
  },
  {
    filename: 'suspense.mp3',
    prompt:
      '20秒纯音乐无人声，神秘暗夜悬疑桌游氛围背景音乐，低沉温暖的大提琴铺底配合轻微空灵铃音，节奏舒缓不刺耳，适合狼人杀与阿瓦隆推理讨论。',
    fallbackFilter:
      'aevalsrc=0.07*sin(2*PI*146.83*t)+0.05*sin(2*PI*174.61*t)+0.03*sin(2*PI*220*t):s=24000:d=16',
  },
  {
    filename: 'party.mp3',
    prompt:
      '20秒纯音乐无人声，轻快时髦的都会派对电子放克律动背景乐，柔和贝斯线与温暖电钢琴和弦，音量均衡适合派对大富翁与绘画接龙背景。',
    fallbackFilter:
      'aevalsrc=0.07*sin(2*PI*261.63*t)+0.05*sin(2*PI*329.63*t)+0.04*sin(2*PI*392*t):s=24000:d=16',
  },
];

async function buildVoices() {
  const manifest: Record<string, { zh: string; en: string }> = {};
  let generatedCount = 0;
  let totalWords = 0;

  // Bounded worker pool (4 concurrent requests max)
  const tasks: Array<() => Promise<void>> = [];

  for (const clip of VOICE_CLIP_CATALOG) {
    manifest[clip.key] = {
      zh: `/audio/voices/zh/${clip.key}.mp3`,
      en: `/audio/voices/en/${clip.key}.mp3`,
    };

    const zhPath = path.join(VOICES_DIR, 'zh', `${clip.key}.mp3`);
    if (!fs.existsSync(zhPath) || fs.statSync(zhPath).size < 1024) {
      tasks.push(async () => {
        const res = await synthesizeDoubaoSpeech({ text: clip.zhText, role: clip.zhRole });
        fs.writeFileSync(zhPath, res.audio);
        generatedCount++;
        totalWords += res.textWords ?? 0;
        console.log(`[tts zh] ${clip.key}.mp3 (${res.audio.length} bytes)`);
      });
    }

    const enPath = path.join(VOICES_DIR, 'en', `${clip.key}.mp3`);
    if (!fs.existsSync(enPath) || fs.statSync(enPath).size < 1024) {
      tasks.push(async () => {
        const res = await synthesizeDoubaoSpeech({ text: clip.enText, role: clip.enRole });
        fs.writeFileSync(enPath, res.audio);
        generatedCount++;
        totalWords += res.textWords ?? 0;
        console.log(`[tts en] ${clip.key}.mp3 (${res.audio.length} bytes)`);
      });
    }
  }

  // Run sequentially in batches of 4
  for (let i = 0; i < tasks.length; i += 4) {
    await Promise.all(tasks.slice(i, i + 4).map((fn) => fn()));
  }

  fs.writeFileSync(path.join(VOICES_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(
    `[voices] Complete. Newly generated: ${generatedCount}, total catalog entries: ${VOICE_CLIP_CATALOG.length} x 2 langs, billed words: ${totalWords}`,
  );
}

async function buildBgm() {
  for (const spec of BGM_SPECS) {
    const outPath = path.join(BGM_DIR, spec.filename);
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 10_000) {
      console.log(`[skip bgm] ${spec.filename} exists`);
      continue;
    }

    const rawPath = path.join(TMP_DIR, `raw-${spec.filename}`);
    try {
      console.log(`[bgm] Generating ${spec.filename} via Seed Audio 1.0...`);
      const buf = await generateSeedAudioBgm({ prompt: spec.prompt });
      fs.writeFileSync(rawPath, buf);
      execFileSync(
        'ffmpeg',
        [
          '-y',
          '-i',
          rawPath,
          '-t',
          '20',
          '-af',
          'afade=t=in:st=0:d=1.2,afade=t=out:st=18.5:d=1.5,volume=0.55',
          '-b:a',
          '96k',
          outPath,
        ],
        { stdio: 'ignore' },
      );
      fs.unlinkSync(rawPath);
      console.log(`[done bgm] ${spec.filename} (${fs.statSync(outPath).size} bytes)`);
    } catch (err) {
      console.warn(`[warn bgm] Seed Audio failed for ${spec.filename}, generating soft ffmpeg fallback:`, err);
      execFileSync(
        'ffmpeg',
        [
          '-y',
          '-f',
          'lavfi',
          '-i',
          spec.fallbackFilter,
          '-af',
          'lowpass=f=700,afade=t=in:st=0:d=1.5,afade=t=out:st=14.5:d=1.5',
          '-b:a',
          '96k',
          outPath,
        ],
        { stdio: 'ignore' },
      );
    }
  }
}

async function main() {
  await buildVoices();
  await buildBgm();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
