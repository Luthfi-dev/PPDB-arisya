import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const ENTRY_FILE = path.join(ROOT_DIR, 'server.ts');
const OUT_FILE = path.join(ROOT_DIR, 'server.js');

async function buildWithEsbuild() {
  const esbuild = await import('esbuild');
  await esbuild.build({
    entryPoints: [ENTRY_FILE],
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    outfile: OUT_FILE,
  });
}

async function buildWithRolldown() {
  const { rolldown } = await import('rolldown');
  const bundle = await rolldown({
    input: ENTRY_FILE,
    platform: 'node',
    external: (id) => !id.startsWith('.') && !id.startsWith('/') && !path.isAbsolute(id),
  });
  try {
    await bundle.write({
      file: OUT_FILE,
      format: 'esm',
    });
  } finally {
    await bundle.close();
  }
}

async function main() {
  try {
    await buildWithEsbuild();
  } catch (esbuildErr) {
    console.warn('[build-server] esbuild tidak tersedia, beralih ke rolldown:', esbuildErr?.message || esbuildErr);
    await buildWithRolldown();
  }

  const stat = fs.statSync(OUT_FILE);
  const kb = (stat.size / 1024).toFixed(1);
  console.log(`  server.js  ${kb}kb`);
}

main().catch((err) => {
  console.error('[build-server] Gagal membangun server.js:', err);
  process.exit(1);
});
