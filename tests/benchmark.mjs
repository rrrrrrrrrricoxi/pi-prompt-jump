// Synthetic tool-free long-session benchmark using Pi's real rendered components.
// Run: node tests/benchmark.mjs /path/to/installed/pi-coding-agent
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { mkdirSync, writeFileSync } from 'node:fs';
import { root, jiti, tuiPath, hostVersion } from './runtime.mjs';
const { Container } = await import(pathToFileURL(tuiPath));
const { initTheme, getMarkdownTheme } = await import(pathToFileURL(`${root}/dist/modes/interactive/theme/theme.js`));
const { UserMessageComponent } = await import(pathToFileURL(`${root}/dist/modes/interactive/components/user-message.js`));
const { AssistantMessageComponent } = await import(pathToFileURL(`${root}/dist/modes/interactive/components/assistant-message.js`));
const { collectPrompts } = await jiti.import(new URL('../navigation.ts', import.meta.url).pathname);
initTheme('dark', false);
const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
const measure = fn => { const start = performance.now(); const result = fn(); return { ms: performance.now() - start, result }; };
const summary = values => {
  const ordered = [...values].sort((a, b) => a - b);
  return { median_ms: ordered[Math.floor(ordered.length / 2)],
    p95_ms: ordered[Math.ceil(ordered.length * .95) - 1], max_ms: ordered.at(-1) };
};
const results = { host_version: hostVersion, node_version: process.version, platform: process.platform,
  samples_per_case: 30, description: 'Real user/assistant components, tool-free synthetic prose and code; added collection cost, not complete terminal-frame latency.', cases: [] };
for (const count of [100, 1000, 5000]) {
  const document = new Container();
  for (let index = 0; index < count; index++) {
    document.addChild(new UserMessageComponent(`Synthetic prompt ${index + 1}: describe the example and check its assumptions.`, getMarkdownTheme(), 1));
    const message = { role: 'assistant', content: [{ type: 'text', text:
      ('This is synthetic explanatory prose for rendered-height and navigation testing.\n\n').repeat(8) +
      '```typescript\nconst example = 42;\nconsole.log(example);\n```' }],
      api: 'smoke-fixture-stream', provider: 'smoke-fixture', model: 'fixture',
      usage, stopReason: 'stop', timestamp: 0 };
    document.addChild(new AssistantMessageComponent(message, false, getMarkdownTheme(), undefined, 1));
  }
  const cold = measure(() => collectPrompts(document, 80));
  assert.equal(cold.result.anchors.length, count);
  const base = [], collection = [];
  for (let i = 0; i < 30; i++) {
    base.push(measure(() => document.render(80)).ms);
    collection.push(measure(() => collectPrompts(document, 80)).ms);
  }
  const resized = measure(() => collectPrompts(document, 40));
  assert.equal(resized.result.anchors.length, count);
  assert.ok(resized.result.height >= cold.result.height);
  const entry = { prompts: count, messages: count * 2, width: 80, rendered_rows: cold.result.height,
    cold_collection_ms: cold.ms, warm_document_render: summary(base), warm_collection: summary(collection),
    resize_to_40_columns_ms: resized.ms, rss_mb: process.memoryUsage().rss / 1024 / 1024,
    raw_warm_document_render_ms: base, raw_warm_collection_ms: collection };
  results.cases.push(entry);
  console.log(JSON.stringify({ ...entry, raw_warm_document_render_ms: undefined, raw_warm_collection_ms: undefined }));
}
mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
writeFileSync(new URL('../test-results/performance.json', import.meta.url), JSON.stringify(results, null, 2) + '\n');
console.log('Recorded timings and all 30 raw samples per case in test-results/performance.json');
