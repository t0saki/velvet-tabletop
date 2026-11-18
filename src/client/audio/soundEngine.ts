import type { Language } from '../../shared/types.js';
import { VOICE_CLIP_CATALOG, type VoiceRolePreset } from '../../shared/voiceClips.js';

export type SfxName =
  | 'buttonTap'
  | 'cardFlip'
  | 'cardSlide'
  | 'chipClink'
  | 'diceRoll'
  | 'gavelBang'
  | 'tick'
  | 'urgentTick'
  | 'revealDrum'
  | 'victoryFanfare'
  | 'emojiPop'
  | 'swordClash'
  | 'wolfHowl'
  | 'cashRegister'
  | 'shutterClick';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private unlocked = false;
  private sfxEnabled = true;
  private bgmEnabled = true;
  private voiceEnabled = true;
  private bgmAudio: HTMLAudioElement | null = null;
  private currentBgmUrl: string | null = null;
  private voiceAudio: HTMLAudioElement | null = null;
  private lastVoiceSeq = 0;
  private lastSfxSeq = 0;
  private listeners = new Set<() => void>();

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  public isUnlocked(): boolean {
    return this.unlocked;
  }

  public getSettings() {
    return {
      unlocked: this.unlocked,
      sfxEnabled: this.sfxEnabled,
      bgmEnabled: this.bgmEnabled,
      voiceEnabled: this.voiceEnabled,
    };
  }

  public setSfxEnabled(val: boolean) {
    this.sfxEnabled = val;
    this.notify();
  }

  public setBgmEnabled(val: boolean) {
    this.bgmEnabled = val;
    if (!val && this.bgmAudio) {
      this.bgmAudio.pause();
    } else if (val && this.bgmAudio && this.unlocked) {
      this.bgmAudio.play().catch(() => {});
    }
    this.notify();
  }

  public setVoiceEnabled(val: boolean) {
    this.voiceEnabled = val;
    if (!val && this.voiceAudio) {
      this.voiceAudio.pause();
    }
    this.notify();
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctor) {
        this.ctx = new Ctor();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.unlocked = true;
    if (this.bgmEnabled && this.bgmAudio && this.bgmAudio.paused) {
      this.bgmAudio.play().catch(() => {});
    }
    this.notify();
  }

  public syncBgm(trackUrl: string, shouldPlayOnThisDevice: boolean): void {
    if (typeof window === 'undefined') return;
    if (!shouldPlayOnThisDevice || !this.bgmEnabled) {
      if (this.bgmAudio && !this.bgmAudio.paused) {
        this.bgmAudio.pause();
      }
      return;
    }

    if (this.currentBgmUrl !== trackUrl) {
      if (this.bgmAudio) {
        this.bgmAudio.pause();
      }
      this.currentBgmUrl = trackUrl;
      const audio = new Audio(trackUrl);
      audio.loop = true;
      audio.volume = 0.22;
      this.bgmAudio = audio;
      if (this.unlocked) {
        audio.play().catch(() => {});
      }
    } else if (this.bgmAudio && this.bgmAudio.paused && this.unlocked) {
      this.bgmAudio.play().catch(() => {});
    }
  }

  public stopBgm(): void {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
    }
  }

  public playVoiceIfNew(
    clipKey: string | undefined,
    seq: number | undefined,
    lang: Language,
    shouldAnnounceOnDevice: boolean,
  ): void {
    if (!clipKey || !seq || seq <= this.lastVoiceSeq) return;
    this.lastVoiceSeq = seq;

    if (!shouldAnnounceOnDevice || !this.voiceEnabled) return;

    const url = `/audio/voices/${lang}/${clipKey}.mp3`;
    if (this.voiceAudio) {
      this.voiceAudio.pause();
    }
    // Duck BGM gently during speech
    if (this.bgmAudio) this.bgmAudio.volume = 0.08;

    const audio = new Audio(url);
    audio.volume = 0.92;
    this.voiceAudio = audio;
    audio.onended = () => {
      if (this.bgmAudio) this.bgmAudio.volume = 0.22;
    };
    audio.onerror = () => {
      if (this.bgmAudio) this.bgmAudio.volume = 0.22;
      this.fallbackBrowserTts(clipKey, lang);
    };
    audio.play().catch(() => {
      if (this.bgmAudio) this.bgmAudio.volume = 0.22;
    });
  }

  private fallbackBrowserTts(clipKey: string, lang: Language): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const entry = VOICE_CLIP_CATALOG.find((c) => c.key === clipKey);
    if (!entry) return;
    this.speakBrowserText(lang === 'zh' ? entry.zhText : entry.enText, lang);
  }

  private speakBrowserText(text: string, lang: Language): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }

  public async speakDynamicLine(
    text: string,
    lang: Language,
    role: VoiceRolePreset,
    shouldAnnounceOnDevice: boolean,
  ): Promise<void> {
    const clean = text.trim().slice(0, 88);
    if (!clean || !shouldAnnounceOnDevice || !this.voiceEnabled || !this.unlocked) return;

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean, lang, role }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      if (this.voiceAudio) this.voiceAudio.pause();
      if (this.bgmAudio) this.bgmAudio.volume = 0.08;
      const audio = new Audio(objUrl);
      audio.volume = 0.92;
      this.voiceAudio = audio;
      audio.onended = () => {
        URL.revokeObjectURL(objUrl);
        if (this.bgmAudio) this.bgmAudio.volume = 0.22;
      };
      await audio.play();
    } catch {
      if (this.bgmAudio) this.bgmAudio.volume = 0.22;
      this.speakBrowserText(clean, lang);
    }
  }

  public haptic(ms = 12): void {
    if (!this.sfxEnabled || typeof navigator === 'undefined') return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      // Ignore on unsupported browsers
    }
  }

  public playServerSfxIfNew(name: string | undefined, seq: number | undefined): void {
    if (!name || !seq || seq <= this.lastSfxSeq) return;
    this.lastSfxSeq = seq;
    this.playSfx(name as SfxName);
  }

  public playSfx(name: SfxName): void {
    if (!this.sfxEnabled || typeof window === 'undefined') return;
    if (!this.ctx) this.unlock();
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;

    const tone = (
      freq: number,
      endFreq: number,
      dur: number,
      type: OscillatorType = 'sine',
      gainVal = 0.14,
      delay = 0,
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + delay);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + delay + dur);
      gain.gain.setValueAtTime(0.001, now + delay);
      gain.gain.linearRampToValueAtTime(gainVal, now + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + dur + 0.02);
    };

    const noiseBurst = (dur: number, filterFreq: number, gainVal = 0.1, delay = 0) => {
      const bufSize = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = filterFreq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(gainVal, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start(now + delay);
    };

    switch (name) {
      case 'buttonTap':
        tone(520, 320, 0.06, 'triangle', 0.08);
        break;
      case 'cardFlip':
        noiseBurst(0.07, 1800, 0.09);
        tone(340, 680, 0.09, 'sine', 0.07, 0.02);
        break;
      case 'cardSlide':
        noiseBurst(0.11, 2400, 0.08);
        break;
      case 'chipClink':
        tone(2200, 2600, 0.06, 'sine', 0.08);
        tone(3100, 2900, 0.07, 'triangle', 0.06, 0.03);
        break;
      case 'diceRoll':
        noiseBurst(0.05, 1100, 0.1, 0);
        noiseBurst(0.05, 1400, 0.09, 0.08);
        noiseBurst(0.06, 950, 0.11, 0.16);
        break;
      case 'gavelBang':
        tone(160, 55, 0.24, 'triangle', 0.22);
        noiseBurst(0.08, 650, 0.14);
        this.haptic(18);
        break;
      case 'tick':
        tone(880, 800, 0.04, 'sine', 0.05);
        break;
      case 'urgentTick':
        tone(1180, 960, 0.06, 'square', 0.06);
        break;
      case 'revealDrum':
        tone(110, 80, 0.18, 'triangle', 0.16, 0);
        tone(146, 110, 0.18, 'triangle', 0.16, 0.14);
        tone(220, 440, 0.35, 'sine', 0.14, 0.28);
        this.haptic(16);
        break;
      case 'victoryFanfare':
        tone(523.25, 523.25, 0.16, 'triangle', 0.14, 0);
        tone(659.25, 659.25, 0.16, 'triangle', 0.14, 0.12);
        tone(783.99, 783.99, 0.18, 'triangle', 0.14, 0.24);
        tone(1046.5, 1046.5, 0.45, 'triangle', 0.18, 0.36);
        this.haptic(25);
        break;
      case 'emojiPop':
        tone(540, 980, 0.1, 'sine', 0.07);
        break;
      case 'swordClash':
        noiseBurst(0.09, 3200, 0.12, 0);
        tone(1480, 920, 0.18, 'triangle', 0.12, 0.01);
        tone(2150, 1400, 0.14, 'sine', 0.09, 0.03);
        this.haptic(15);
        break;
      case 'wolfHowl':
        tone(260, 420, 0.32, 'sine', 0.12, 0);
        tone(420, 290, 0.48, 'sine', 0.11, 0.3);
        break;
      case 'cashRegister':
        tone(1320, 1320, 0.07, 'triangle', 0.12, 0);
        tone(2093, 2093, 0.26, 'sine', 0.14, 0.07);
        this.haptic(14);
        break;
      case 'shutterClick':
        noiseBurst(0.035, 3600, 0.13, 0);
        tone(900, 450, 0.04, 'square', 0.06, 0.02);
        this.haptic(10);
        break;
    }
  }
}

export const soundEngine = new SoundEngine();
