import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initialMemorial } from '../src/memorial.ts';

const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const files = [...new Set([initialMemorial.portrait, ...initialMemorial.photos])].filter(Boolean);
if (!files.length) throw new Error('Add published photographs before generating a share slideshow.');
const inputs = files.map(file => {
  const full = path.resolve(publicRoot, '.' + file);
  if (!file.startsWith('/memories/') || !full.startsWith(publicRoot) || !statSync(full).isFile()) throw new Error('Slideshow photographs must be local files in public/memories.');
  return full;
});
const shareRoot = path.join(publicRoot, 'share');
mkdirSync(shareRoot, { recursive: true });
const hold = 3;
const fade = .5;
const graph = inputs.map((_, index) => `[${index}:v]scale=648:648:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=720:720:(ow-iw)/2:(oh-ih)/2:color=0xf5f0e6,setsar=1,fps=30,format=yuv420p,settb=AVTB,setpts=PTS-STARTPTS[s${index}]`);
let previous = 's0';
for (let index = 1; index < inputs.length; index++) {
  const next = `fade${index}`;
  graph.push(`[${previous}][s${index}]xfade=transition=fade:duration=${fade}:offset=${index * (hold - fade)}[${next}]`);
  previous = next;
}
function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('FFmpeg could not generate the share assets.');
}
const video = path.join(shareRoot, 'slideshow-v1.mp4');
ffmpeg([...inputs.flatMap(file => ['-loop', '1', '-t', String(hold), '-i', file]), '-filter_complex_threads', '1', '-filter_complex', graph.join(';'), '-map', `[${previous}]`, '-c:v', 'libx264', '-profile:v', 'main', '-level', '3.1', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '23', '-an', '-map_metadata', '-1', '-movflags', '+faststart', video]);
const poster = path.join(shareRoot, 'slideshow-poster-v1.jpg');
ffmpeg(['-i', inputs[0], '-vf', 'scale=1080:1080:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=1200:1200:(ow-iw)/2:(oh-ih)/2:color=0xf5f0e6', '-frames:v', '1', '-q:v', '3', '-map_metadata', '-1', poster]);
const bytes = statSync(video).size + statSync(poster).size;
if (bytes > 9_000_000) throw new Error('Share assets exceed the small-preview size budget.');
console.log(JSON.stringify({ photographs: inputs.length, duration: inputs.length * hold - (inputs.length - 1) * fade, videoBytes: statSync(video).size, posterBytes: statSync(poster).size }));
