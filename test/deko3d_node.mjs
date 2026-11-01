// Makes deko3d_glsl.bin from the game (disc image or folder) in Node, with the page's code (lib/deko3d.js). With
// katamari-nx's native GLSL (out/deko3d_shaders/glsl_opt) it also compares the shaders text for text.
// Usage: node test/deko3d_node.mjs <disc image or game folder> <katamari_shader_files.json> [<native glsl_opt folder>]
//        [--out <file>]
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chosenOnDisk, loadModules, root } from './node_files.mjs';
import { findGame, gameContainers, identifyGame, lzxStep } from '../lib/installer.js';
import { buildDeko3dPackage } from '../lib/deko3d.js';

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const out = outAt >= 0 ? args.splice(outAt, 2)[1] : null;
const [input, listPath, reference] = args;
if (!input || !listPath) {
  console.error('usage: node test/deko3d_node.mjs <disc image or game folder> <katamari_shader_files.json> ' +
    '[<native glsl_opt folder>] [--out <file>]');
  process.exit(1);
}
const sha = (b) => createHash('sha256').update(b).digest('hex');
const started = Date.now();

const { game } = await findGame(chosenOnDisk([input]));
if (!game) {
  throw new Error(`no game in ${input}`);
}
const modules = await loadModules();
const { xex, xexHash } = await identifyGame(game.files, { builds: [] });
console.log(`default.xex SHA-256 ${xexHash}`);
const list = JSON.parse(fs.readFileSync(listPath, 'utf8'));
const containers = await gameContainers(game.files, xex, list, lzxStep(modules.lzx));
console.log(`${containers.length} containers (${list.image_sha256.length} in default.xex)`);

const common = fs.readFileSync(path.join(root, 'renut_shader_common.h'));
const { package: pkg, shaders } = await buildDeko3dPackage(containers, null, modules, common);
console.log(`${shaders.length} shaders, package ${pkg.length} bytes, SHA-256 ${sha(pkg)} (${Date.now() - started} ms)`);
if (out) {
  fs.writeFileSync(out, pkg);
}

if (reference) {
  let same = 0;
  const different = [];
  for (const s of shaders) {
    const file = path.join(reference, `${s.name}.glsl`);
    if (!fs.existsSync(file)) {
      different.push(`${s.name} (no native file)`);
    } else if (fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n') === s.glsl) {
      same++;
    } else {
      different.push(s.name);
    }
  }
  console.log(`${same} of ${shaders.length} shaders' GLSL identical to the native chain's`);
  if (different.length) {
    console.log(`different: ${different.join(' ')}`);
  }
  const debug = process.env.DEKO3D_DEBUG_DIR;
  if (debug) {
    fs.mkdirSync(debug, { recursive: true });
    for (const s of shaders) {
      fs.writeFileSync(path.join(debug, `${s.name}.glsl`), s.glsl);
    }
  }
}
