// Test-only fail-closed network guard, preloaded before the isolated Pi CLI.
const deny = () => { throw new Error('SMOKE TEST: network access is forbidden'); };
require('node:net').Socket.prototype.connect = deny;
require('node:dns').lookup = deny;
globalThis.fetch = deny;
