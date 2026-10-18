// Pack/extract locally, or download the published artifact with --published,
// then run the real-CLI smoke suite. No dependency installation, lifecycle scripts,
// or persistent package activation. Only --published requires a registry download.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const source = fileURLToPath(new URL('../', import.meta.url));
import { root as host } from './runtime.mjs';
const sourceVersion = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8')).version;
const published = process.argv.includes('--published');
const temporary = mkdtempSync(join(tmpdir(), 'pi-prompt-jump-packed-'));
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: source, encoding: 'utf8', timeout: 60000, ...options });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} failed: ${result.error || result.status}\n${result.stdout || ''}\n${result.stderr || ''}`);
  }
  return result;
}
try {
  const target = published
    ? [`pi-prompt-jump@${sourceVersion}`, '--registry=https://registry.npmjs.org/', '--prefer-online']
    : ['--offline'];
  const output = run('npm', ['pack', ...target, '--ignore-scripts', '--json', '--pack-destination', temporary]);
  const [packed] = JSON.parse(output.stdout);
  const names = packed.files.map(file => file.path).sort();
  assert.deepEqual(names, ['CHANGELOG.md', 'LICENSE', 'README.md', 'RELEASE-CHECKLIST.md',
    'TEST-RESULTS.md', 'controller.ts', 'host.ts', 'index.ts', 'navigation.ts', 'package.json', 'templates.ts'].sort());
  run('tar', ['-xzf', join(temporary, packed.filename), '-C', temporary]);
  const packageDirectory = join(temporary, 'package');
  const manifest = JSON.parse(readFileSync(join(packageDirectory, 'package.json'), 'utf8'));
  assert.equal(manifest.name, 'pi-prompt-jump');
  assert.equal(manifest.version, sourceVersion);
  assert.equal(manifest.license, 'MIT');
  assert.ok(manifest.keywords.includes('pi-package'));
  assert.deepEqual(manifest.pi.extensions, ['./index.ts']);
  if (published) {
    for (const name of names) {
      assert.ok(readFileSync(join(packageDirectory, name)).equals(readFileSync(join(source, name))),
        `Published file differs from approved source: ${name}`);
    }
    console.log(`PASS: published npm artifact matches all eleven approved source files; integrity ${packed.integrity}`);
  }
  console.log('PASS: exact eleven-file npm artifact; MIT license and standalone extension entry');
  const result = run('python3', ['-u', join(source, 'tests/terminal-smoke.py'), host], {
    env: { ...process.env, PI_SMOKE_PACKAGE_DIR: packageDirectory },
  });
  process.stdout.write(result.stdout);
  console.log('PASS: full real-CLI smoke suite ran against extracted npm artifact, not source entry');
} finally {
  rmSync(temporary, { recursive: true, force: true }); // Only this test's generated package/archive.
}
