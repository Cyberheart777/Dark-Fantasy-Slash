/**
 * AudioManager.ts — Singleton Web Audio API engine.
 *
 * Architecture:
 *   masterGain → sfxGain  → destination (one-shot SFX)
 *   masterGain → musicGain → destination (looping music)
 *
 * If a sound has a src URL it is fetched, decoded, and cached.
 * If no src is provided the built-in procedural synth is used as a fallback.
 * Volume changes take effect immediately via GainNode.gain.
 */

import { SOUND_REGISTRY, type SoundKey } from "./SoundData";

class AudioManager {
  private _ctx: AudioContext | null = null;
  private _masterGain!: GainNode;
  private _sfxGain!: GainNode;
  private _musicGain!: GainNode;

  /** Decoded AudioBuffer cache for file-backed sounds. */
  private _buffers: Map<SoundKey, AudioBuffer> = new Map();
  /** Currently playing music nodes. */
  private _musicNodes: { src: AudioBufferSourceNode | null; osc: OscillatorNode[] } = { src: null, osc: [] };
  /** Currently playing music key (for idempotent playMusic). */
  private _currentMusicKey: SoundKey | null = null;

  private _master = 0.6;
  private _sfx = 0.7;
  private _music = 0.3;
  private _muted = false;

  // ─── Context bootstrap ──────────────────────────────────────────────────────

  private ctx(): AudioContext {
    if (!this._ctx) {
      this._ctx = new AudioContext();
      this._masterGain = this._ctx.createGain();
      this._sfxGain    = this._ctx.createGain();
      this._musicGain  = this._ctx.createGain();
      this._sfxGain.connect(this._masterGain);
      this._musicGain.connect(this._masterGain);
      this._masterGain.connect(this._ctx.destination);
      this._applyVolumes();
    }
    if (this._ctx.state === "suspended") this._ctx.resume();
    return this._ctx;
  }

  private _applyVolumes() {
    if (!this._masterGain) return;
    const m = this._muted ? 0 : this._master;
    this._masterGain.gain.value = m;
    this._sfxGain.gain.value    = this._sfx;
    this._musicGain.gain.value  = this._music;
  }

  setVolume(master: number, sfx: number, music: number, muted: boolean) {
    this._master = master;
    this._sfx    = sfx;
    this._music  = music;
    this._muted  = muted;
    this._applyVolumes();
  }

  // ─── File loading ───────────────────────────────────────────────────────────

  private async _loadBuffer(key: SoundKey, src: string): Promise<void> {
    try {
      const ctx = this.ctx();
      const resp = await fetch(src);
      const ab   = await resp.arrayBuffer();
      const buf  = await ctx.decodeAudioData(ab);
      this._buffers.set(key, buf);
    } catch {
      // Silently fall back to synth
    }
  }

  /** Preload all file-backed sounds. Call once when the game starts. */
  async preload(): Promise<void> {
    const loads: Promise<void>[] = [];
    for (const [key, def] of Object.entries(SOUND_REGISTRY) as [SoundKey, typeof SOUND_REGISTRY[SoundKey]][]) {
      if (def.src) {
        loads.push(this._loadBuffer(key as SoundKey, def.src));
      }
    }
    await Promise.allSettled(loads);
  }

  // ─── Playback ───────────────────────────────────────────────────────────────

  play(key: SoundKey): void {
    const def = SOUND_REGISTRY[key];
    if (!def || def.category !== "sfx") return;
    const vol = def.volume ?? 1.0;
    try {
      const ctx = this.ctx();
      if (this._buffers.has(key)) {
        const src = ctx.createBufferSource();
        src.buffer = this._buffers.get(key)!;
        const g = ctx.createGain();
        g.gain.value = vol;
        src.connect(g).connect(this._sfxGain);
        src.start();
      } else {
        this._synth(key, vol, ctx);
      }
    } catch {
      // AudioContext not available (e.g. headless test)
    }
  }

  /**
   * Play a music loop. Idempotent — if the requested key is already playing,
   * this is a no-op (so calling playMusic on every phase re-render is safe).
   * Passing a different key will cross-stop the current loop and start the new one.
   */
  playMusic(key: SoundKey = "music_dungeon"): void {
    if (this._currentMusicKey === key && (this._musicNodes.src || this._musicNodes.osc.length > 0)) {
      return; // already playing this track
    }
    try {
      const ctx = this.ctx();
      this.stopMusic();
      this._currentMusicKey = key;
      const def = SOUND_REGISTRY[key];
      if (!def || def.category !== "music") return;
      if (def.src && this._buffers.has(key)) {
        const src = ctx.createBufferSource();
        src.buffer = this._buffers.get(key)!;
        src.loop = true;
        const g = ctx.createGain();
        g.gain.value = def.volume ?? 1;
        src.connect(g).connect(this._musicGain);
        src.start();
        this._musicNodes.src = src;
      } else {
        this._synthMusic(ctx, key);
      }
    } catch { /* headless */ }
  }

  stopMusic(): void {
    try {
      this._musicNodes.src?.stop();
      this._musicNodes.src = null;
      for (const o of this._musicNodes.osc) { try { o.stop(); } catch {} }
      this._musicNodes.osc = [];
      this._currentMusicKey = null;
    } catch {}
  }

  /**
   * Resume the audio context. Browsers block the AudioContext from starting
   * until a user gesture — call this from a click/keydown handler to unlock
   * audio playback at app boot.
   */
  resume(): void {
    try {
      const ctx = this.ctx();
      if (ctx.state === "suspended") void ctx.resume();
    } catch {}
  }

  // ─── Procedural synthesis ───────────────────────────────────────────────────

  private _synth(key: SoundKey, vol: number, ctx: AudioContext): void {
    const t = ctx.currentTime;
    switch (key) {
      case "attack_melee":    this._synthBurst(ctx, t, 180, 0.04, 0.06, vol, "sawtooth");  break;
      case "attack_orb":      this._synthTone(ctx, t, 440, 880, 0.08, 0.12, vol);          break;
      case "attack_dagger":   this._synthBurst(ctx, t, 800, 0.02, 0.04, vol * 0.8, "square"); break;
      case "enemy_death":     this._synthNoise(ctx, t, 0.05, 0.18, vol, 0.3, 1.0);        break;
      case "player_hurt":     this._synthTone(ctx, t, 220, 110, 0.02, 0.18, vol, "square"); break;
      case "player_death":    this._synthNoise(ctx, t, 0.1, 0.7, vol, 0.05, 0.6);         break;
      case "level_up":        this._synthArpeggio(ctx, t, [261, 329, 392, 523], vol);      break;
      case "xp_pickup":       this._synthTone(ctx, t, 880, 1200, 0.01, 0.08, vol * 0.6);  break;
      case "dash":            this._synthNoise(ctx, t, 0.01, 0.14, vol * 0.7, 0.8, 0.1);  break;
      // Distinct crystalline chime for gear drops — more resonant than pickup, ringing downward
      case "gear_drop":       this._synthGearDrop(ctx, t, vol);                            break;
      // Soft chime marking a wave transition
      case "wave_clear":      this._synthArpeggio(ctx, t, [392, 523, 659], vol * 0.75);    break;
      case "boss_spawn":      this._synthBossStab(ctx, t, vol);                             break;
      case "boss_special":    this._synthBossRumble(ctx, t, vol);                          break;
      case "boss_death":      this._synthBossDeath(ctx, t, vol);                           break;
      case "menu_click":      this._synthBurst(ctx, t, 600, 0.005, 0.04, vol * 0.5, "sine"); break;
      default: break;
    }
  }

  /** Sine tone with frequency sweep. */
  private _synthTone(ctx: AudioContext, t: number, freqStart: number, freqEnd: number, attack: number, release: number, vol: number, type: OscillatorType = "sine") {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t + attack + release);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + attack + release);
    osc.connect(g).connect(this._sfxGain);
    osc.start(t);
    osc.stop(t + attack + release + 0.01);
  }

  /** Clicky distorted burst. */
  private _synthBurst(ctx: AudioContext, t: number, freq: number, attack: number, release: number, vol: number, type: OscillatorType) {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + release);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + attack + release);
    osc.connect(g).connect(this._sfxGain);
    osc.start(t);
    osc.stop(t + attack + release + 0.01);
  }

  /** White noise burst (using AudioBuffer). */
  private _synthNoise(ctx: AudioContext, t: number, attack: number, release: number, vol: number, loFreq: number, hiFreq: number) {
    const dur    = attack + release;
    const frames = Math.ceil(dur * ctx.sampleRate);
    const buf    = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1);
    // Band-pass filter
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(loFreq * 500 + 80, t);
    filter.frequency.exponentialRampToValueAtTime(hiFreq * 200 + 80, t + dur);
    filter.Q.value = 0.5;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(g).connect(this._sfxGain);
    src.start(t);
    src.stop(t + dur + 0.01);
  }

  /** Crystalline drop chime — two stacked bells with a bright shimmer tail. */
  private _synthGearDrop(ctx: AudioContext, t: number, vol: number) {
    // Two bell tones: bright high + mid fundamental, descending pitch for "drop" feel
    this._synthTone(ctx, t, 1760, 1320, 0.005, 0.45, vol * 0.55, "sine");
    this._synthTone(ctx, t + 0.02, 880, 660, 0.005, 0.5, vol * 0.45, "triangle");
    // Short shimmer noise for sparkle
    this._synthNoise(ctx, t + 0.01, 0.005, 0.15, vol * 0.2, 1.2, 1.6);
  }

  /** Rising arpeggio for level-up. */
  private _synthArpeggio(ctx: AudioContext, t: number, freqs: number[], vol: number) {
    freqs.forEach((freq, i) => {
      const onset = t + i * 0.1;
      this._synthTone(ctx, onset, freq, freq * 1.5, 0.02, 0.15, vol * 0.7);
    });
  }

  /** Deep dramatic stab for boss spawn. */
  private _synthBossStab(ctx: AudioContext, t: number, vol: number) {
    // Low rumble
    this._synthTone(ctx, t, 60, 30, 0.05, 0.8, vol, "sawtooth");
    // High crash
    this._synthNoise(ctx, t, 0.03, 0.4, vol * 0.6, 0.3, 0.9);
    // Mid impact
    this._synthBurst(ctx, t, 120, 0.04, 0.3, vol * 0.8, "square");
  }

  /** Low ominous rumble for boss special. */
  private _synthBossRumble(ctx: AudioContext, t: number, vol: number) {
    this._synthTone(ctx, t, 80, 40, 0.1, 1.2, vol * 0.8, "sawtooth");
    this._synthNoise(ctx, t, 0.05, 0.8, vol * 0.4, 0.2, 0.4);
  }

  /** Triumphant crash for boss death. */
  private _synthBossDeath(ctx: AudioContext, t: number, vol: number) {
    this._synthNoise(ctx, t, 0.05, 0.6, vol, 0.1, 0.9);
    [130, 196, 261, 392].forEach((freq, i) => {
      this._synthTone(ctx, t + i * 0.08, freq, freq * 0.5, 0.05, 0.5, vol * 0.6, "sawtooth");
    });
  }

  /**
   * Procedural ambient music fallback.
   * Menu track is slightly lighter (higher drone + softer whisper), dungeon
   * track is the original dark minor drone.
   */
  private _synthMusic(ctx: AudioContext, key: SoundKey = "music_dungeon") {
    const freqs = key === "music_menu"
      ? [73.4, 98, 146.8, 220]       // D2, G2, D3, A3 — slightly brighter minor
      : [55, 82.4, 110, 130.8];      // A1, E2, A2, C3 — dark minor drone
    const oscs: OscillatorNode[] = [];

    freqs.forEach((freq, i) => {
      // Main oscillator
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      // LFO for slow vibrato
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.07 + i * 0.03;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = freq * 0.008;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      // Gain with slow fade-in
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.08 - i * 0.015, ctx.currentTime + 3);

      osc.connect(g).connect(this._musicGain);
      osc.start();
      lfo.start();
      oscs.push(osc, lfo);
    });

    // Occasional high sine whisper
    const whisper = ctx.createOscillator();
    whisper.type = "sine";
    whisper.frequency.value = 440;
    const wg = ctx.createGain();
    wg.gain.setValueAtTime(0, ctx.currentTime);
    wg.gain.linearRampToValueAtTime(0.015, ctx.currentTime + 6);
    whisper.connect(wg).connect(this._musicGain);
    whisper.start();
    oscs.push(whisper);

    this._musicNodes.osc = oscs;
  }
}

/** Singleton — import and call anywhere. */
export const audioManager = new AudioManager();
