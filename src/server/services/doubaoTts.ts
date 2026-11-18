import crypto from 'node:crypto';
import type { VoiceRolePreset } from '../../shared/voiceClips.js';

export interface VoicePresetConfig {
  speaker: string;
  instruction: string;
  speechRate: number;
  pitch?: number;
}

export const DOUBAO_VOICE_PRESETS: Record<VoiceRolePreset, VoicePresetConfig> = {
  zh_judge_suspense: {
    speaker: 'zh_male_xuanyijieshuo_uranus_bigtts',
    instruction: '请用低沉、神秘、充满悬疑压迫感的法官语气缓慢播报',
    speechRate: -5,
    pitch: -2,
  },
  zh_judge_solemn: {
    speaker: 'zh_male_baqiqingshu_uranus_bigtts',
    instruction: '请用威严庄重、沉稳有力的法官口吻播报',
    speechRate: -4,
  },
  zh_dealer_female: {
    speaker: 'zh_female_gaolengyujie_uranus_bigtts',
    instruction: '请用冷静专业、利落优雅的VIP赌场荷官语气播报',
    speechRate: 0,
  },
  zh_host_female: {
    speaker: 'zh_female_shuangkuaisisi_uranus_bigtts',
    instruction: '请用超级欢快热情、充满活力的派对主持人语气播报',
    speechRate: 5,
  },
  en_judge_werewolf: {
    speaker: 'en_male_deep-voice_uranus_bigtts',
    instruction: 'Speak in a deep, mysterious, suspenseful narrator voice',
    speechRate: -5,
  },
  en_judge_avalon: {
    speaker: 'en_male_knightley_uranus_bigtts',
    instruction: 'Speak in a solemn, dramatic British narrator tone',
    speechRate: -3,
  },
  en_dealer_male: {
    speaker: 'en_male_tim_uranus_bigtts',
    instruction: 'Speak like a crisp, calm Vegas poker dealer',
    speechRate: 0,
  },
  en_host_female: {
    speaker: 'en_female_dacey_uranus_bigtts',
    instruction: 'Speak like an excited, cheerful party game show host',
    speechRate: 5,
  },
};

const DOUBAO_TTS_V3_URL = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';
const DOUBAO_AUDIO_CREATE_URL = 'https://openspeech.bytedance.com/api/v3/tts/create';

export class AsyncSemaphore {
  private active = 0;
  private queue: Array<() => void> = [];
  constructor(private readonly maxConcurrency: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await task();
    } finally {
      this.active--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

const ttsSemaphore = new AsyncSemaphore(4);

async function synthesizeOnce(params: {
  text: string;
  role: VoiceRolePreset;
  apiKey: string;
}): Promise<{ audio: Buffer; textWords: number | null }> {
  const preset = DOUBAO_VOICE_PRESETS[params.role];
  const additions = JSON.stringify({
    disable_markdown_filter: true,
    enable_auto_language_recognition: true,
    context_texts: [preset.instruction],
    ...(preset.pitch ? { post_process: { pitch: preset.pitch } } : {}),
  });

  const res = await fetch(DOUBAO_TTS_V3_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': params.apiKey,
      'X-Api-Resource-Id': 'seed-tts-2.0',
      'X-Api-Request-Id': crypto.randomUUID(),
      'X-Control-Require-Usage-Tokens-Return': '*',
    },
    body: JSON.stringify({
      user: { uid: 'velvet-tabletop-build' },
      req_params: {
        text: params.text,
        speaker: preset.speaker,
        audio_params: {
          format: 'mp3',
          sample_rate: 24000,
          bit_rate: 64000,
          speech_rate: preset.speechRate,
          loudness_rate: 8,
          enable_subtitle: false,
        },
        additions,
      },
    }),
  });

  const logId = res.headers.get('x-tt-logid');
  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Doubao TTS HTTP ${res.status} (logId=${logId}): ${errText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let lineBuffer = '';
  const audioChunks: Buffer[] = [];
  let finishedCleanly = false;
  let textWords: number | null = null;

  const processLine = (rawLine: string) => {
    const line = rawLine.trim();
    if (!line) return;
    const msg = JSON.parse(line) as {
      code: number;
      message?: string;
      data?: string | null;
      usage?: { text_words?: number };
    };
    if (msg.code === 0) {
      if (msg.data) audioChunks.push(Buffer.from(msg.data, 'base64'));
      return;
    }
    if (msg.code === 20000000) {
      finishedCleanly = true;
      textWords = msg.usage?.text_words ?? null;
      return;
    }
    const err = new Error(`Doubao TTS stream error [${msg.code}] (logId=${logId}): ${msg.message}`);
    (err as Error & { code?: number }).code = msg.code;
    throw err;
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    lineBuffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = lineBuffer.indexOf('\n')) !== -1) {
      const line = lineBuffer.slice(0, idx);
      lineBuffer = lineBuffer.slice(idx + 1);
      processLine(line);
    }
  }
  if (lineBuffer.trim()) processLine(lineBuffer);

  if (!finishedCleanly || audioChunks.length === 0) {
    throw new Error(`Doubao TTS incomplete stream without code=20000000 (logId=${logId})`);
  }

  return { audio: Buffer.concat(audioChunks), textWords };
}

export async function synthesizeDoubaoSpeech(params: {
  text: string;
  role: VoiceRolePreset;
  apiKey?: string;
}): Promise<{ audio: Buffer; textWords: number | null }> {
  const apiKey = params.apiKey ?? process.env.DOUBAO_API_KEY;
  if (!apiKey) throw new Error('Missing DOUBAO_API_KEY');

  return ttsSemaphore.run(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await synthesizeOnce({ text: params.text, role: params.role, apiKey });
      } catch (err) {
        const code = (err as Error & { code?: number }).code;
        if (code === 45000292 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    throw new Error('Exhausted Doubao TTS retries');
  });
}

export async function generateSeedAudioBgm(params: {
  prompt: string;
  apiKey?: string;
}): Promise<Buffer> {
  const apiKey = params.apiKey ?? process.env.DOUBAO_API_KEY;
  if (!apiKey) throw new Error('Missing DOUBAO_API_KEY');

  const res = await fetch(DOUBAO_AUDIO_CREATE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({
      model: 'seed-audio-1.0',
      text_prompt: params.prompt,
      audio_config: {
        format: 'mp3',
        sample_rate: 24000,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Seed Audio HTTP ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { audio?: string; url?: string; code?: number; message?: string };
  if (data.audio) {
    return Buffer.from(data.audio, 'base64');
  }
  if (data.url) {
    const dl = await fetch(data.url);
    if (!dl.ok) throw new Error(`Failed downloading seed-audio URL: ${dl.status}`);
    return Buffer.from(await dl.arrayBuffer());
  }
  throw new Error(`Seed Audio unexpected payload: ${JSON.stringify(data).slice(0, 200)}`);
}
