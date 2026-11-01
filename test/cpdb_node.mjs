// Checks lib/cpdb.js: decodes the records of katamari-nx's tools/katamari_shader_files.py from the game and compares each
// container with its SHA-256.
// Usage: node test/cpdb_node.mjs <game folder> <katamari_shader_files.json>
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { decompressCpdb } from '../lib/cpdb.js';

const [game, list] = process.argv.slice(2);
if (!game || !list) {
  console.error('usage: node test/cpdb_node.mjs <game folder> <katamari_shader_files.json>');
  process.exit(1);
}
const files = JSON.parse(fs.readFileSync(list, 'utf8')).files;
const started = Date.now();
let good = 0;
let bad = 0;
for (const f of files) {
  const fd = fs.openSync(path.join(game, f.archive.replaceAll('\\', '/')), 'r');
  const block = Buffer.alloc(f.stored);
  fs.readSync(fd, block, 0, f.stored, f.offset);
  fs.closeSync(fd);
  const data = f.compressed ? decompressCpdb(block) : block.subarray(0, f.size);
  for (const c of f.containers) {
    const hash = createHash('sha256').update(data.subarray(c.at, c.at + c.length)).digest('hex');
    if (hash === c.sha256) {
      good++;
    } else {
      bad++;
    }
  }
}
console.log(`${files.length} records: ${good} containers match, ${bad} differ (${Date.now() - started} ms)`);
process.exit(bad ? 1 : 0);
