const Sound = {
  ctx: null,
  master: null,
  musicGain: null,
  muted: false,
  musicOn: true,
  musicTimer: null,

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.25;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.12;
      this.musicGain.connect(this.master);
    } catch (e) {}
  },

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  },

  toggleMute() {
    this.resume();
    this.muted = !this.muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.25, this.ctx.currentTime, 0.05);
    }
    const btn = document.getElementById("mute-btn");
    if (btn) btn.classList.toggle("off", this.muted);
  },

  toggleMusic() {
    this.resume();
    this.musicOn = !this.musicOn;
    if (this.musicOn) this.startMusic(); else this.stopMusic();
    const btn = document.getElementById("music-btn");
    if (btn) btn.classList.toggle("off", !this.musicOn);
  },

  playNote(freq, type, duration, when, destination, volume) {
    if (!this.ctx) return;
    const t = when || this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume || 0.2, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(destination || this.master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  },

  playCollect() {
    this.playNote(523.25, "sine", 0.1, undefined, undefined, 0.18);
    this.playNote(659.25, "sine", 0.12, this.ctx.currentTime + 0.08, undefined, 0.18);
  },

  playBuild() {
    this.playNote(70, "sine", 0.18, undefined, undefined, 0.3);
    this.playNote(55, "triangle", 0.12, undefined, undefined, 0.2);
  },

  playTrain() {
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.playNote(f, "triangle", 0.16, t + i * 0.08, undefined, 0.16));
  },

  playAttack() {
    this.playNote(140, "square", 0.08, undefined, undefined, 0.22);
  },

  playDeath() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.35);
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.4);
  },

  playGameStart() {
    const t = this.ctx.currentTime;
    [392, 493.88, 587.33, 783.99, 1046.5].forEach((f, i) => this.playNote(f, "triangle", 0.22, t + i * 0.12, undefined, 0.18));
  },

  playVictory() {
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, i) => this.playNote(f, "triangle", 0.28, t + i * 0.14, undefined, 0.18));
  },

  playDefeat() {
    const t = this.ctx.currentTime;
    [392, 349.23, 311.13, 261.63, 196].forEach((f, i) => this.playNote(f, "sawtooth", 0.3, t + i * 0.12, undefined, 0.14));
  },

  playClick() {
    this.playNote(900, "sine", 0.03, undefined, undefined, 0.08);
  },

  startMusic() {
    this.resume();
    if (!this.ctx || !this.musicOn) return;
    this.musicOn = true;
    this.stopMusic();
    this.scheduleMusicBar(0);
  },

  scheduleMusicBar(barOffset) {
    if (!this.musicOn || !this.ctx) return;
    const t = this.ctx.currentTime + barOffset;
    const bass = [110, 130.81, 164.81, 196];
    const melody = [523.25, 659.25, 783.99, 659.25];
    bass.forEach((f, i) => this.playNote(f, "sine", 0.5, t + i * 0.5, this.musicGain, 0.1));
    melody.forEach((f, i) => this.playNote(f, "triangle", 0.5, t + i * 0.5, this.musicGain, 0.07));
    this.musicTimer = setTimeout(() => this.scheduleMusicBar(0), 4000);
  },

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }
};

window.Sound = Sound;
