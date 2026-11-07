// Generates the vendor app's alert sounds into assets/sounds/.
// Run from ordering/: node tool/make_sounds.js
// The sounds are synthesised bells, so there is nothing to license.
const fs = require('fs');
const path = require('path');

const RATE = 22050;

// A struck bell: a few slightly detuned partials that fade out.
function bell(t, freq, decay) {
  if (t < 0) return 0;
  const attack = Math.min(1, t / 0.004); // 4ms ramp, no click
  const tone =
    Math.sin(2 * Math.PI * freq * t) +
    0.5 * Math.sin(2 * Math.PI * freq * 2.01 * t) +
    0.25 * Math.sin(2 * Math.PI * freq * 3.03 * t);
  return attack * Math.exp(-t * decay) * tone;
}

function render(seconds, voice) {
  const out = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < out.length; i++) out[i] = voice(i / RATE);
  // Normalise to 90% of full scale.
  const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  return out.map((v) => (v / peak) * 0.9);
}

function writeWav(file, samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(v * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, data]));
}

// Paid (also played for a new order): a short "cha" of noise, then a bright two-note "ching".
let seed = 1;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const paid = render(0.9, (t) => {
  const cha = t < 0.05 ? noise() * (1 - t / 0.05) * 0.6 : 0;
  return cha + bell(t - 0.06, 1760, 6) + 0.8 * bell(t - 0.16, 2637, 6);
});

// Served: one soft, low ding.
const served = render(0.8, (t) => bell(t, 880, 6));

const dir = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(dir, { recursive: true });
writeWav(path.join(dir, 'paid.wav'), paid);
writeWav(path.join(dir, 'served.wav'), served);
console.log('Wrote', fs.readdirSync(dir).join(', '));
