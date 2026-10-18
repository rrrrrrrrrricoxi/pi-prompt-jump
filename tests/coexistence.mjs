// Optional sibling-source integration: real native cards, no CLI/model/service calls.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { jiti, tuiPath, tuiRoot, hostImport } from './runtime.mjs';
const renderer = resolve(process.env.PI_COMPACT_RENDERER_PATH || new URL('../../compact-tool-renderers', import.meta.url).pathname);
const { default: compact } = await jiti.import(join(renderer, 'index.ts'));
const { default: promptJump } = await jiti.import(new URL('../index.ts', import.meta.url).pathname);
const { collectPrompts } = await jiti.import(new URL('../navigation.ts', import.meta.url).pathname);
const { Container, Text, ScrollView, VStack, matchesKey } = await import(pathToFileURL(tuiPath));
const { VIEWPORT_TUI } = await import(pathToFileURL(join(tuiRoot, 'dist/tui.js')));
const { UserMessageComponent, AssistantMessageComponent, ToolExecutionComponent } = await hostImport('index.js');
const { initTheme, theme, getMarkdownTheme } = await hostImport('modes/interactive/theme/theme.js');
const { readRenderers } = await hostImport('core/tools/renderers/read.js');
initTheme('dark', false);
const native = { render: UserMessageComponent.prototype.render, mouse: UserMessageComponent.prototype.handleMouse };
const temporary = mkdtempSync(join(tmpdir(), 'prompt-jump-coexist-'));
const previousAgent = process.env.PI_CODING_AGENT_DIR;
process.env.PI_CODING_AGENT_DIR = temporary;
const template = 'These invented template instructions are long enough to wrap across several lines.\n\n' + 'Preserve all original source text and use the sample only for display checks. '.repeat(12);
const templatePath = join(temporary, 'fixture.md'); writeFileSync(templatePath, template);
const stripKey = Symbol.for('notrico/sticky-prompt-strip/owner');
try {
  // Both extension loading orders and a fresh registration after shutdown.
  for (const order of [[compact, promptJump], [promptJump, compact], [compact, promptJump]]) {
    const hooks = new Map(), bus = new Map(), commands = new Map(), shortcuts = new Map(), inputs = new Set(), transformers = [], widgets = new Map();
    let resolver, currentRoot;
    const subscribe = (map, key, fn) => { const listeners = map.get(key) || new Set(); map.set(key, listeners); listeners.add(fn); return () => listeners.delete(fn); };
    const api = {
      on: (key, fn) => subscribe(hooks, key, fn),
      events: { on: (key, fn) => subscribe(bus, key, fn), emit: (key, value) => { for (const fn of [...bus.get(key) || []]) fn(value); } },
      getCommands: () => [{ name: 'fixture', source: 'prompt', sourceInfo: { path: templatePath } }],
      registerCommand: (name, definition) => { assert.ok(!commands.has(name), `duplicate command ${name}`); commands.set(name, definition); },
      registerShortcut: (key, definition) => shortcuts.set(key, definition),
      registerMarkdownTransformer: fn => transformers.push(fn), registerToolRenderer: fn => { resolver = fn; },
    };
    // Unlisted APIs fail: neither extension can invoke model/history/execution APIs.
    const pi = new Proxy(api, { get(target, key) { assert.ok(key in target, `unexpected API ${String(key)}`); return target[key]; } });
    for (const extension of order) extension(pi);
    const document = new Container();
    const scroll = new ScrollView(document, { follow: 'end', primary: true });
    const original = new VStack([{ component: scroll, grow: 1 }, { component: new Text('fixture editor', 0, 0) }]);
    currentRoot = original;
    const tui = { mode: 'fullscreen', [VIEWPORT_TUI]: true, terminal: { columns: 60, rows: 24 }, getMountedRoots: () => [currentRoot], setLayoutRoot: root => { currentRoot = root; }, requestRender() {} };
    const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
    const recorded = { role: 'assistant', content: [{ type: 'thinking', thinking: 'Invented recorded round for keyboard routing and row heights.' }], api: 'fixture', provider: 'fixture', model: 'fixture', usage, stopReason: 'stop', timestamp: 0 };
    const exact = JSON.stringify(recorded);
    const ctx = { mode: 'tui', hasUI: true, sessionManager: { getBranch: () => [{ type: 'message', message: recorded }] }, ui: {
      theme, setHiddenThinkingLabel() {}, onTerminalInput(fn) { inputs.add(fn); return () => inputs.delete(fn); }, notify() {},
      setWidget(key, factory) { widgets.get(key)?.dispose?.(); factory ? widgets.set(key, factory(tui, theme)) : widgets.delete(key); },
      async select(_title, options) { return options[0]; },
    } };
    const emit = (name, value = {}) => { for (const fn of [...hooks.get(name) || []]) fn(value, ctx); };
    const key = data => [...inputs].some(fn => fn(data)?.consume);
    emit('session_start', { reason: 'startup' });
    const first = new UserMessageComponent(template, getMarkdownTheme(), 1, transformers);
    const thinking = new AssistantMessageComponent(recorded, true, getMarkdownTheme(), undefined, 1);
    const makeTool = (id, path) => {
      const component = new ToolExecutionComponent('read', id, { path }, { showImages: false, outputPad: 1 }, resolver('read', () => readRenderers), { requestRender() {} }, '/fixture');
      component.setArgsComplete(); component.markExecutionStarted();
      component.updateResult({ content: [{ type: 'text', text: 'Invented output\n'.repeat(30) }], details: {} });
      return component;
    };
    const one = makeTool('one', '/fixture/one'), two = makeTool('two', '/fixture/two');
    const second = new UserMessageComponent('Second human prompt with 中文 🙂 '.repeat(5), getMarkdownTheme(), 1, transformers);
    document.addChild(first); document.addChild(thinking); document.addChild(one); document.addChild(two); document.addChild(second);
    document.addChild(new Text('tail\n'.repeat(30), 0, 0));
    const measure = () => {
      const width = scroll.getContentWidth(tui.terminal.columns);
      const snapshot = collectPrompts(document, width);
      assert.equal(snapshot.anchors.length, 2);
      assert.equal(snapshot.height, document.render(width).length);
      assert.equal(snapshot.anchors[1].row, first.render(width).length + thinking.render(width).length + one.render(width).length + two.render(width).length);
      scroll.updateLayout(snapshot.height, 10, () => {});
      return snapshot;
    };
    const control = () => currentRoot[stripKey];
    const collapsed = measure();
    assert.equal(first.text, template);
    assert.match(first.render(60).join('\n'), /prompt · \/fixture/);
    assert.equal(key('\x1bi'), true); assert.equal(key('\r'), true);
    const promptOpen = measure(); assert.ok(promptOpen.anchors[1].row > collapsed.anchors[1].row, 'expanded template shifts next prompt');
    key('\x1b'); assert.equal(key('\x1bg'), true); assert.equal(key('\r'), true);
    const toolsOpen = measure(); assert.ok(toolsOpen.anchors[1].row > promptOpen.anchors[1].row, 'expanded success group shifts next prompt');
    key('\x1b'); assert.equal(key('\x1bt'), true); assert.equal(key('\r'), true); measure(); key('\x1b');
    for (const [sequence, shortcut] of [['\x1b[1;4A', 'alt+shift+up'], ['\x1b[1;4B', 'alt+shift+down']]) {
      assert.equal(key(sequence), false, 'renderer does not consume prompt arrows');
      assert.equal(matchesKey(sequence, shortcut), true); assert.ok(shortcuts.has(shortcut));
    }
    scroll.scrollTo(0, { disableFollow: true }); await shortcuts.get('alt+shift+down').handler();
    assert.equal(scroll.scrollTop, measure().anchors[1].row);
    await commands.get('prompt-jump').handler('back', ctx); assert.equal(scroll.scrollTop, 0);
    await commands.get('prompt-jump').handler('end', ctx); assert.equal(scroll.isFollowingEnd, true);
    const wrapped = currentRoot, render = UserMessageComponent.prototype.render;
    control().dispose(); assert.equal(currentRoot, original); assert.equal(UserMessageComponent.prototype.render, render, 'strip cleanup preserves renderer adapter');
    emit('session_start', { reason: 'reload' }); assert.ok(control()?.mounted); assert.notEqual(currentRoot, wrapped); assert.equal(currentRoot.children[1], original, 'reload has exactly one strip wrapper');
    assert.equal(inputs.size, 3, 'reload replaces all renderer input listeners');
    const foreign = new VStack([new Text('foreign root', 0, 0)]); currentRoot = foreign;
    emit('session_shutdown'); for (const widget of widgets.values()) widget.dispose?.();
    assert.equal(currentRoot, foreign, 'shutdown preserves foreign replacement root');
    assert.equal(inputs.size, 0); assert.equal(first.text, template); assert.equal(JSON.stringify(recorded), exact);
    assert.deepEqual({ render: UserMessageComponent.prototype.render, mouse: UserMessageComponent.prototype.handleMouse }, native, 'shutdown restores native prototypes');
  }
  console.log('PASS: both package orders, native collapsed/expanded prompt/thinking/tool heights, Unicode/wrapping, independent shortcuts, back/end, reload listener/root cleanup, foreign-root ownership, and exact recorded sources');
} finally {
  previousAgent === undefined ? delete process.env.PI_CODING_AGENT_DIR : process.env.PI_CODING_AGENT_DIR = previousAgent;
  rmSync(temporary, { recursive: true, force: true });
}
