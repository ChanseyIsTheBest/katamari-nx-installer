// Checks the release files in release/ against the SHA-256 that release/manifest.json names for each, as the page does
// (worker.js fetchRelease): every build's NRO, its other files and its variants.txt, and shader_common.h.
// Usage: node .github/verify_release.mjs (from the root of the repository)
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const manifest = JSON.parse(fs.readFileSync('release/manifest.json', 'utf8'));
let bad = 0;
const check = (name, want, what) => {
  const path = `release/${name}`;
  if (!fs.existsSync(path)) {
    console.error(`missing: ${name} (${what})`);
    bad++;
    return;
  }
  const hash = createHash('sha256').update(fs.readFileSync(path)).digest('hex');
  if (hash !== want) {
    console.error(`wrong SHA-256: ${name} is ${hash}, the list expects ${want}`);
    bad++;
  } else {
    console.log(`ok: ${name} (${what})`);
  }
};
for (const build of manifest.builds) {
  const what = `${build.edition} ${manifest.version}`;
  check(build.nro, build.nro_sha256, what);
  for (const file of build.files || []) check(file.source, file.sha256, what);
  if (build.variants_sha256) check('variants.txt', build.variants_sha256, what);
}
if (manifest.shader_common_sha256) check('shader_common.h', manifest.shader_common_sha256, 'the translator header');
if (bad) {
  process.exit(1);
}
