// Encode the 16-bit stereo WAV from make_song.py to MP3.
// One-off tool, deliberately not a project dependency:
//   npm install --no-save @breezystack/lamejs
//   node tools/song/encode_mp3.mjs in.wav public/audio/happy-birthday.mp3
import { readFileSync, writeFileSync } from 'node:fs';
import { Mp3Encoder } from '@breezystack/lamejs';

const [input, output] = process.argv.slice(2);
const wav = readFileSync(input);
const dataAt = wav.indexOf('data') + 8;
const pcm = new Int16Array(wav.buffer, wav.byteOffset + dataAt, (wav.length - dataAt) >> 1);

const frames = pcm.length / 2;
const left = new Int16Array(frames);
const right = new Int16Array(frames);
for (let i = 0; i < frames; i++) {
  left[i] = pcm[i * 2];
  right[i] = pcm[i * 2 + 1];
}

const encoder = new Mp3Encoder(2, 44100, 128);
const chunks = [];
for (let i = 0; i < frames; i += 1152) {
  chunks.push(encoder.encodeBuffer(left.subarray(i, i + 1152), right.subarray(i, i + 1152)));
}
chunks.push(encoder.flush());
writeFileSync(output, Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
console.log(`${output}: ${(frames / 44100).toFixed(1)}s`);
