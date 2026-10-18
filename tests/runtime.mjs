import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const localRequire = createRequire(import.meta.url);
let selected = process.env.PI_INSTALL_ROOT || process.argv[2];
if (!selected) {
  try { selected = dirname(dirname(localRequire.resolve('@earendil-works/pi-coding-agent'))); }
  catch { selected = join(process.env.PI_RUNTIME || join(homedir(), '.local/state/pi-config/current/runtime'), 'node_modules/@earendil-works/pi-coding-agent'); }
}
export const root = resolve(selected);
export const require = createRequire(join(root, 'package.json'));
export const hostVersion = require('./package.json').version;
assert.equal(hostVersion, '1.3.0', 'Integration tests require Pi 1.3.0');
export const tuiPath = require.resolve('@earendil-works/pi-tui');
export const tuiRoot = dirname(dirname(tuiPath));
const { createJiti } = require('jiti');
export const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false, alias: {
  '@earendil-works/pi-tui': tuiPath,
  '@earendil-works/pi-coding-agent': join(root, 'dist/index.js'),
} });
export const hostImport = file => import(pathToFileURL(join(root, 'dist', file)).href);
