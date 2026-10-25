'use strict';
const fs = require('fs');
const path = require('path');

// Generate 44.1kHz 16-bit PCM Mono WAV file of a real Emergency Police Siren (Wail & Yelp)
const sampleRate = 44100;
const durationSeconds = 6.0; // 6 seconds seamless loop
const totalSamples = Math.floor(sampleRate * durationSeconds);

// WAV Header (44 bytes)
const header = Buffer.alloc(44);
const dataSize = totalSamples * 2; // 16-bit = 2 bytes per sample
const fileSize = 36 + dataSize;

header.write('RIFF', 0);
header.writeUInt32LE(fileSize, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16); // Subchunk1Size
header.writeUInt16LE(1, 20);  // PCM = 1
header.writeUInt16LE(1, 22);  // Mono = 1
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(sampleRate * 2, 28); // ByteRate
header.writeUInt16LE(2, 32);  // BlockAlign
header.writeUInt16LE(16, 34); // BitsPerSample
header.write('data', 36);
header.writeUInt32LE(dataSize, 40);

const pcmData = Buffer.alloc(dataSize);

// Police Siren Profile:
// First 3 seconds: classic rising and falling high-power Wail (650 Hz to 1400 Hz)
// Second 3 seconds: fast urgent piercing Yelp (750 Hz to 1350 Hz, 3 cycles per sec)
let phase = 0;

for (let i = 0; i < totalSamples; i++) {
  const t = i / sampleRate;
  let freq;

  if (t < 3.0) {
    // Wail: smooth sine sweep 650Hz <-> 1350Hz over 3.0 seconds
    const cycle = (Math.sin((t / 3.0) * 2 * Math.PI - Math.PI / 2) + 1) / 2; // 0 to 1
    freq = 650 + cycle * 700;
  } else {
    // Yelp: fast urgent wail (3 cycles per second)
    const yelpT = t - 3.0;
    const yelpCycle = (yelpT * 3.5) % 1.0; // sawtooth sweep 0 to 1
    freq = 750 + yelpCycle * 600;
  }

  phase += (2 * Math.PI * freq) / sampleRate;
  if (phase > 2 * Math.PI) phase -= 2 * Math.PI;

  // Synthesize rich horn sound: Fundamental + 2nd harmonic + 3rd harmonic + subtle clip
  // Real siren horns are slightly driven square/sawtooth
  const fundamental = Math.sin(phase);
  const h2 = 0.35 * Math.sin(2 * phase);
  const h3 = 0.25 * Math.sin(3 * phase);
  const h4 = 0.15 * Math.sin(4 * phase);

  let sample = fundamental + h2 + h3 + h4;
  // Soft horn overdrive saturation
  sample = Math.tanh(sample * 1.4);

  // Convert to 16-bit PCM integer (-32767 to 32767)
  const intSample = Math.max(-32767, Math.min(32767, Math.floor(sample * 28000)));
  pcmData.writeInt16LE(intSample, i * 2);
}

const outDir = path.join(__dirname, '..', 'frontend', 'public', 'sounds');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const outPath = path.join(outDir, 'police_siren.wav');
fs.writeFileSync(outPath, Buffer.concat([header, pcmData]));
console.log(`✅ Generated Police Siren audio: ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
