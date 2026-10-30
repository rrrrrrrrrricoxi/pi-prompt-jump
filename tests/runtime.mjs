import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const localRequire = createRequire(import.meta.url);
let selected = process.env.PI_INSTALL_ROOT || process.argv[2] ||
  (process.env.PI_RUNTIME && join(process.env.PI_RUNTIME, 'node_modules/@earendil-works/pi-coding-agent'));
if (!selected) {
  try { selected = dirname(dirname(localRequire.resolve('@earendil-works/pi-coding-agent'))); }
  catch {
    const managed = join(homedir(), '.pi/agent/install');
    let version;
    try { version = readFileSync(join(managed, 'current-version'), 'utf8').trim(); } catch {}
    const runtime = [
      ...(version ? [join(managed, 'releases', version)] : []),
      join(homedir(), '.local/state/pi-config/current/runtime'),
    ].find(path => existsSync(join(path, 'node_modules/@earendil-works/pi-coding-agent/package.json')));
    if (!runtime) throw new Error('Supply PI_INSTALL_ROOT or a Pi package directory as the first argument');
    selected = join(runtime, 'node_modules/@earendil-works/pi-coding-agent');
  }
}
export const root = resolve(selected);
export const require = createRequire(join(root, 'package.json'));
export const hostVersion = require('./package.json').version;
export const tuiPath = require.resolve('@earendil-works/pi-tui');
export const tuiRoot = dirname(dirname(tuiPath));
const { createJiti } = require('jiti');
export const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false, alias: {
  '@earendil-works/pi-tui': tuiPath,
  '@earendil-works/pi-coding-agent': join(root, 'dist/index.js'),
} });
export const hostImport = file => import(pathToFileURL(join(root, 'dist', file)).href);
