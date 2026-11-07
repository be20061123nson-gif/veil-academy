const TONES = Object.freeze({
  basic: { wave: 'triangle', from: 640, to: 420, length: .055, volume: .035 },
  fire: { wave: 'sawtooth', from: 210, to: 92, length: .16, volume: .08 },
  ice: { wave: 'sine', from: 780, to: 360, length: .18, volume: .065 },
  lightning: { wave: 'square', from: 1040, to: 250, length: .12, volume: .045 },
  nature: { wave: 'triangle', from: 260, to: 390, length: .2, volume: .06 },
  dash: { wave: 'sawtooth', from: 320, to: 120, length: .13, volume: .04 },
  hit: { wave: 'triangle', from: 180, to: 72, length: .19, volume: .07 },
  steamBurst: { wave: 'sine', from: 280, to: 620, length: .2, volume: .07 },
  lightningVines: { wave: 'square', from: 1120, to: 360, length: .18, volume: .055 },
  frozenThorns: { wave: 'sine', from: 620, to: 190, length: .24, volume: .065 },
  level: { wave: 'triangle', from: 390, to: 780, length: .32, volume: .07 },
  boss: { wave: 'sawtooth', from: 110, to: 55, length: .65, volume: .11 },
  death: { wave: 'sine', from: 240, to: 70, length: .42, volume: .065 },
});

export class AudioBus {
  constructor(storage = undefined) {
    try { this.storage = storage ?? globalThis.localStorage; } catch { this.storage = null; }
    try { this.enabled = this.storage?.getItem('veil-audio-enabled') !== 'false'; }
    catch { this.enabled = true; }
    this.context = null;
    this.activeVoices = 0;
  }

  unlock() {
    if (!this.enabled) return false;
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) return false;
    try {
      if (!this.context) this.context = new Context();
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      return true;
    } catch { return false; }
  }

  toggle() {
    this.enabled = !this.enabled;
    try { this.storage?.setItem('veil-audio-enabled', String(this.enabled)); } catch {}
    return this.enabled;
  }

  play(id) {
    if (!this.enabled || !this.context || this.activeVoices >= 8) return false;
    const tone = TONES[id];
    if (!tone) return false;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = tone.wave;
    oscillator.frequency.setValueAtTime(tone.from, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, tone.to), now + tone.length);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(tone.volume, now + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, now + tone.length);
    oscillator.connect(gain); gain.connect(this.context.destination);
    this.activeVoices++;
    oscillator.onended = () => {
      oscillator.disconnect(); gain.disconnect();
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    };
    oscillator.start(now); oscillator.stop(now + tone.length + .015);
    return true;
  }
}
