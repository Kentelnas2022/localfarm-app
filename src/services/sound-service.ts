// Cross-platform ambient sound synthesizer & audio player for Local Farm Stories

let activeAudioCtx: any = null;
let activeGainNode: any = null;
let isAudioPlaying = false;
let currentPlayingTitle: string | null = null;
let activeLoopTimers: any[] = [];
let htmlAudioElement: any = null;

function getAudioContext(): any {
  if (typeof window === "undefined") return null;
  const AudioContextClass =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!activeAudioCtx || activeAudioCtx.state === "closed") {
    activeAudioCtx = new AudioContextClass();
  }
  if (activeAudioCtx && activeAudioCtx.state === "suspended") {
    activeAudioCtx.resume().catch(() => {});
  }
  return activeAudioCtx;
}

export function stopStorySoundtrack(): void {
  try {
    activeLoopTimers.forEach((timer) => clearTimeout(timer));
    activeLoopTimers = [];

    if (htmlAudioElement) {
      htmlAudioElement.pause();
      htmlAudioElement.currentTime = 0;
      htmlAudioElement = null;
    }

    if (activeGainNode && activeAudioCtx) {
      try {
        activeGainNode.gain.cancelScheduledValues(activeAudioCtx.currentTime);
        activeGainNode.gain.setValueAtTime(activeGainNode.gain.value, activeAudioCtx.currentTime);
        activeGainNode.gain.linearRampToValueAtTime(0.0001, activeAudioCtx.currentTime + 0.15);
      } catch (_) {}
    }

    setTimeout(() => {
      if (activeAudioCtx && !isAudioPlaying) {
        try {
          activeAudioCtx.suspend().catch(() => {});
        } catch (_) {}
      }
    }, 200);

    isAudioPlaying = false;
    currentPlayingTitle = null;
  } catch (err) {
    console.warn("[SoundService] Error stopping sound:", err);
  }
}

export function getCurrentPlayingTrack(): string | null {
  return isAudioPlaying ? currentPlayingTitle : null;
}

/**
 * Procedural ambient synthesizer for farm story soundtracks
 */
export function playStorySoundtrack(trackTitle: string, volume: number = 0.4): void {
  stopStorySoundtrack();

  const ctx = getAudioContext();
  if (!ctx) return;

  isAudioPlaying = true;
  currentPlayingTitle = trackTitle;

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.5);
  masterGain.connect(ctx.destination);
  activeGainNode = masterGain;

  switch (trackTitle) {
    case "Morning Harvest Birds":
      playMorningBirds(ctx, masterGain);
      break;
    case "Country Road Acoustic":
      playAcousticChords(ctx, masterGain);
      break;
    case "Golden Hour Sunrise":
      playWarmSunrisePad(ctx, masterGain);
      break;
    case "Greenhouse Rain Melodies":
      playRainAmbient(ctx, masterGain);
      break;
    case "Farm Rooster Morning Call":
      playRoosterCall(ctx, masterGain);
      break;
    case "Soft Breeze over Fields":
      playWindBreeze(ctx, masterGain);
      break;
    default:
      playWarmSunrisePad(ctx, masterGain);
      break;
  }
}

// 1. Morning Harvest Birds: Gentle harmonic pad + procedural birds chirping
function playMorningBirds(ctx: any, destination: any) {
  // Gentle base drone chord (D major - peaceful dawn)
  const freqs = [146.83, 220.0, 293.66, 369.99]; // D3, A3, D4, F#4
  freqs.forEach((f) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f, ctx.currentTime);
    g.gain.setValueAtTime(0.04, ctx.currentTime);
    osc.connect(g);
    g.connect(destination);
    osc.start();
  });

  // Chirping birds generator
  function chirp() {
    if (!isAudioPlaying) return;
    try {
      const chirpOsc = ctx.createOscillator();
      const chirpGain = ctx.createGain();
      chirpOsc.type = "sine";

      const baseFreq = 2200 + Math.random() * 800;
      const now = ctx.currentTime;
      chirpOsc.frequency.setValueAtTime(baseFreq, now);
      chirpOsc.frequency.exponentialRampToValueAtTime(baseFreq + 600, now + 0.06);
      chirpOsc.frequency.exponentialRampToValueAtTime(baseFreq - 200, now + 0.12);

      chirpGain.gain.setValueAtTime(0.001, now);
      chirpGain.gain.linearRampToValueAtTime(0.12, now + 0.02);
      chirpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      chirpOsc.connect(chirpGain);
      chirpGain.connect(destination);
      chirpOsc.start(now);
      chirpOsc.stop(now + 0.16);

      // Repeat with random rhythm
      const nextTime = 700 + Math.random() * 2200;
      const timer = setTimeout(chirp, nextTime);
      activeLoopTimers.push(timer);
    } catch (_) {}
  }

  chirp();
}

// 2. Country Road Acoustic: Warm arpeggiated acoustic guitar progression (C - G - Am - F)
function playAcousticChords(ctx: any, destination: any) {
  const chords = [
    [130.81, 196.0, 261.63, 329.63], // C major
    [98.0, 146.83, 196.0, 246.94],   // G major
    [110.0, 164.81, 220.0, 261.63],  // A minor
    [87.31, 130.81, 174.61, 220.0],  // F major
  ];

  let chordIndex = 0;
  let noteIndex = 0;

  function pluckNote() {
    if (!isAudioPlaying) return;
    try {
      const currentChord = chords[chordIndex];
      const freq = currentChord[noteIndex];
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Triangle wave with slight lowpass sounds like a mellow nylon acoustic guitar
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(now);
      osc.stop(now + 0.75);

      noteIndex = (noteIndex + 1) % currentChord.length;
      if (noteIndex === 0) {
        chordIndex = (chordIndex + 1) % chords.length;
      }

      const timer = setTimeout(pluckNote, 320);
      activeLoopTimers.push(timer);
    } catch (_) {}
  }

  pluckNote();
}

// 3. Golden Hour Sunrise: Warm lush ambient synth pad
function playWarmSunrisePad(ctx: any, destination: any) {
  const padFreqs = [174.61, 220.0, 261.63, 349.23, 440.0]; // F major 9
  padFreqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    // Gentle LFO for breathing effect
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(0.2 + idx * 0.05, ctx.currentTime);
    lfoGain.gain.setValueAtTime(0.02, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    osc.connect(gain);
    gain.connect(destination);

    osc.start();
    lfo.start();
  });
}

// 4. Greenhouse Rain Melodies: Soothing rain sound + soft pentatonic water chimes
function playRainAmbient(ctx: any, destination: any) {
  // Pink-like rain noise
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = (lastOut + 0.02 * white) / 1.02;
    lastOut = data[i];
    data[i] *= 3.5;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(750, ctx.currentTime);

  const rainGain = ctx.createGain();
  rainGain.gain.setValueAtTime(0.07, ctx.currentTime);

  noise.connect(filter);
  filter.connect(rainGain);
  rainGain.connect(destination);
  noise.start();

  // Periodic water droplet chimes
  const chimeFreqs = [523.25, 659.25, 783.99, 1046.5]; // C, E, G, C
  function drop() {
    if (!isAudioPlaying) return;
    try {
      const dropOsc = ctx.createOscillator();
      const dropGain = ctx.createGain();
      const freq = chimeFreqs[Math.floor(Math.random() * chimeFreqs.length)];
      const now = ctx.currentTime;

      dropOsc.type = "sine";
      dropOsc.frequency.setValueAtTime(freq, now);
      dropOsc.frequency.exponentialRampToValueAtTime(freq * 1.05, now + 0.08);

      dropGain.gain.setValueAtTime(0.001, now);
      dropGain.gain.linearRampToValueAtTime(0.09, now + 0.02);
      dropGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

      dropOsc.connect(dropGain);
      dropGain.connect(destination);

      dropOsc.start(now);
      dropOsc.stop(now + 0.55);

      const nextDrop = 900 + Math.random() * 1800;
      const timer = setTimeout(drop, nextDrop);
      activeLoopTimers.push(timer);
    } catch (_) {}
  }

  drop();
}

// 5. Farm Rooster Morning Call: Realistic dawn rooster clarion
function playRoosterCall(ctx: any, destination: any) {
  // Morning ambient background
  playMorningBirds(ctx, destination);

  function crow() {
    if (!isAudioPlaying) return;
    try {
      const notes = [
        { freq: 440, duration: 0.25 }, // Errr
        { freq: 520, duration: 0.35 }, // Errr
        { freq: 660, duration: 0.5 },  // Err
        { freq: 580, duration: 0.8 },  // Ooooo
      ];

      let delay = 0;
      notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";

        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(1200, ctx.currentTime);
        filter.Q.setValueAtTime(3, ctx.currentTime);

        const startTime = ctx.currentTime + delay;
        osc.frequency.setValueAtTime(n.freq, startTime);
        osc.frequency.linearRampToValueAtTime(n.freq * 1.08, startTime + n.duration);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.12, startTime + 0.04);
        gain.gain.linearRampToValueAtTime(0.001, startTime + n.duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(destination);

        osc.start(startTime);
        osc.stop(startTime + n.duration);
        delay += n.duration * 0.9;
      });

      const nextCrow = 6000 + Math.random() * 4000;
      const timer = setTimeout(crow, nextCrow);
      activeLoopTimers.push(timer);
    } catch (_) {}
  }

  crow();
}

// 6. Soft Breeze over Fields: Gentle wind swells
function playWindBreeze(ctx: any, destination: any) {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(300, ctx.currentTime);
  filter.Q.setValueAtTime(1.5, ctx.currentTime);

  // Modulate wind frequency
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = "sine";
  lfo.frequency.setValueAtTime(0.15, ctx.currentTime);
  lfoGain.gain.setValueAtTime(180, ctx.currentTime);

  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, ctx.currentTime);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(destination);

  noise.start();
  lfo.start();
}
