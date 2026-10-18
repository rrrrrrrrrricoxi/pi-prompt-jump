import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import { root, tuiPath, tuiRoot, jiti } from './tests/runtime.mjs';
const {Container,Text,ScrollView,VStack,visibleWidth,parseColor,foregroundAnsi,backgroundAnsi,matchesKey}=await import(pathToFileURL(tuiPath));
const {VIEWPORT_TUI}=await import(pathToFileURL(`${tuiRoot}/dist/tui.js`));
const {initTheme,getMarkdownTheme,theme,loadThemeFromPath,setThemeInstance,getAvailableThemesWithPaths,setTerminalColors,setTerminalColorScheme}=await import(pathToFileURL(`${root}/dist/modes/interactive/theme/theme.js`));
const {UserMessageComponent}=await import(pathToFileURL(`${root}/dist/modes/interactive/components/user-message.js`));
const {SkillInvocationMessageComponent}=await import(pathToFileURL(`${root}/dist/modes/interactive/components/skill-invocation-message.js`));
initTheme('dark',false);
const nav=await jiti.import(new URL('./navigation.ts',import.meta.url).pathname);
const {installStrip}=await jiti.import(new URL('./controller.ts',import.meta.url).pathname);
const doc=new Container();
doc.addChild(new Text('session header',0,0));
const chat=new Container(); doc.addChild(chat);
chat.addChild(new UserMessageComponent('First human prompt\nAdditional instructions',getMarkdownTheme(),1));
chat.addChild(new Text('model output\n'.repeat(12),0,0));
chat.addChild(new UserMessageComponent('Second prompt with 中文 and wide characters 測試 '.repeat(4),getMarkdownTheme(),1));
chat.addChild(new Text('next model output\n'.repeat(24),0,0));
let {anchors,height}=nav.collectPrompts(doc,80);
assert.equal(anchors.length,2);
assert.equal(nav.precedingPrompt(anchors,0),undefined);
assert.equal(nav.precedingPrompt(anchors,anchors[0].end+3),anchors[0]);
assert.equal(nav.precedingPrompt(anchors,anchors[1].row),anchors[1]);
assert.equal(nav.navigationTarget(anchors,anchors[0].end+3,'prev'),anchors[0]);
assert.equal(nav.navigationTarget(anchors,anchors[0].row,'prev'),undefined);
assert.equal(nav.navigationTarget(anchors,anchors[0].row,'next'),anchors[1]);
assert.ok(nav.collectPrompts(doc,20).anchors[1].end > anchors[1].end);
assert.equal(nav.firstLine('first line\nsecond line'),'first line');
// Unknown/subclass shapes must keep native height without becoming fake anchors.
const PretendUser=class UserMessageComponent extends Container {};
const pretend=new PretendUser(); pretend.text='not a native user card'; pretend.addChild(new Text('opaque row',0,0));
assert.equal(nav.collectPrompts(pretend,80).anchors.length,0);
const Group=class Container extends Text {};
const opaqueGroup=new Group('expanded group\nsecond row\nthird row',0,0);
opaqueGroup.children=[new Text('misleading internal child',0,0)];
const opaqueDoc=new Container(); opaqueDoc.addChild(opaqueGroup); opaqueDoc.addChild(new UserMessageComponent('after group',getMarkdownTheme(),1));
assert.equal(nav.collectPrompts(opaqueDoc,80).anchors[0].row,opaqueGroup.render(80).length);

assert.ok(!nav.firstLine('\x1b]52;c;secret\x07safe').includes('\x1b'));
const scroll=new ScrollView(doc,{follow:'end',primary:true});
scroll.updateLayout(height,6,()=>{});
const original=new VStack([{component:scroll,grow:1},{component:new Text('editor',0,0)}]);
let currentRoot=original, renders=0, focusChanges=0;
const tui={mode:'fullscreen',[VIEWPORT_TUI]:true,terminal:{columns:80,rows:24},getMountedRoots:()=>[currentRoot],setLayoutRoot:r=>{currentRoot=r;},requestRender:()=>{renders++;},setFocus:()=>{focusChanges++;}};
// Use Pi's real theme: a mock style() previously accepted raw hex strings and hid a startup crash.
const control=installStrip(tui,theme);
assert.ok(control?.mounted);
scroll.scrollTo(anchors[0].end+3,{disableFollow:true});
assert.match(control.strip.render(80)[0],/Prompt 1\/2 · First human prompt/);
function assertStripColors(appearance) {
 assert.equal(theme.appearance,appearance);
 const fg=parseColor(appearance==='light'?'#454545':'#c8c8c8');
 const bg=parseColor(appearance==='light'?'#e4e4e4':'#303238');
 for(const width of [1,10,30,80]) {
  const lines=control.strip.render(width);
  assert.equal(lines.length,1);
  assert.equal(visibleWidth(lines[0]),width);
  assert.ok(lines[0].includes(foregroundAnsi(fg,theme.getColorMode())));
  assert.ok(lines[0].includes(backgroundAnsi(bg,theme.getColorMode())));
 }
}
// Change themes on the same mounted strip, including the system theme's terminal-default fallback.
for(const mode of ['truecolor','256color']) {
 for(const appearance of ['light','dark']) {
  const path=getAvailableThemesWithPaths().find(t=>t.name===appearance).path;
  setThemeInstance(loadThemeFromPath(path,mode));
  assertStripColors(appearance);
 }
}
setTerminalColors({});
for(const appearance of ['light','dark']) {
 setTerminalColorScheme(appearance);
 initTheme('system',false);
 assertStripColors(appearance);
}
setTerminalColorScheme(undefined);
initTheme('dark',false);
const before=scroll.scrollTop;
assert.deepEqual(control.strip.handleMouse({type:'click',button:'left',x:5,y:0}),{handled:true});
assert.equal(scroll.scrollTop,anchors[0].row);
assert.equal(focusChanges,0);
assert.equal(control.navigate('back'),true); assert.equal(scroll.scrollTop,before);
assert.equal(control.navigate('next'),true); assert.equal(scroll.scrollTop,anchors[1].row);
assert.match(control.strip.render(80)[0],/Prompt 2\/2/);
assert.equal(control.navigate('end'),true); assert.equal(scroll.isFollowingEnd,true);
assert.equal(control.navigate('current'),true); assert.equal(scroll.isFollowingEnd,false);
assert.equal(control.navigate('back'),true); assert.equal(scroll.isFollowingEnd,true);
const generation=control.generation; control.reset(); assert.equal(control.generation,generation+1); assert.equal(control.navigate('back'),false);
// Native skill blocks plus argument text are a single prompt anchor.
const skillDoc=new Container();
skillDoc.addChild(new SkillInvocationMessageComponent({name:'example',content:'skill instructions',userMessage:'my arguments'},getMarkdownTheme(),1));
skillDoc.addChild(new UserMessageComponent('my arguments',getMarkdownTheme(),1));
assert.equal(nav.collectPrompts(skillDoc,80).anchors.length,1);
assert.equal(nav.collectPrompts(skillDoc,80).anchors[0].label,'/skill:example');
// Reloading replaces our own wrapper rather than nesting permanent extra rows.
const replacement=installStrip(tui,theme);
assert.ok(replacement?.mounted); assert.equal(control.mounted,false);
replacement.dispose(); assert.equal(currentRoot,original);
const next=installStrip(tui,theme); const otherRoot=new VStack([new Text('another extension',0,0)]); currentRoot=otherRoot;
next.dispose(); assert.equal(currentRoot,otherRoot);
assert.equal(installStrip({...tui,mode:'regular'},theme),undefined);
assert.equal(installStrip(tui,theme,undefined,'1.1.0'),undefined);
assert.equal(installStrip(tui,theme,undefined,'9.0.0'),undefined);
assert.equal(currentRoot,otherRoot,'unsupported host leaves the foreign root untouched');
assert.equal(installStrip({...tui,getMountedRoots:undefined},theme),undefined);
assert.ok(renders>0);
// Register and exercise the actual extension handlers, not just navigation helpers.
// Isolate UI preferences without creating/writing a file or loading user authentication.
const previousAgent=process.env.PI_CODING_AGENT_DIR;
const shortcutDir=mkdtempSync(join(tmpdir(),'pi-prompt-jump-shortcuts-'));
process.env.PI_CODING_AGENT_DIR=shortcutDir;
try {
 const extension=await jiti.import(new URL('./index.ts',import.meta.url).pathname);
 const shortcuts=new Map(), hooks=new Map();
 let widget;
 extension.default({getCommands:()=>[],on:(event,handler)=>hooks.set(event,handler),registerCommand(){},registerShortcut:(key,definition)=>shortcuts.set(key,definition)});
 assert.deepEqual([...shortcuts.keys()],['alt+shift+up','alt+shift+down']);
 assert.equal(matchesKey('\x1b[1;4A',extension.PROMPT_SHORTCUTS.prev),true);
 assert.equal(matchesKey('\x1b[1;4B',extension.PROMPT_SHORTCUTS.next),true);
 assert.equal(matchesKey('\x1b[1;7A',extension.PROMPT_SHORTCUTS.prev),false); // Old Ctrl+Alt+Up removed.
 assert.equal(matchesKey('\x1b[1;3A',extension.PROMPT_SHORTCUTS.prev),false); // Don't steal Pi's Alt+Up.
 currentRoot=original;
 hooks.get('session_start')({}, {mode:'tui',hasUI:true,ui:{setWidget:(_key,factory)=>{widget=factory?.(tui,theme);}}});
 scroll.scrollTo(anchors[0].end+3,{disableFollow:true});
 await shortcuts.get(extension.PROMPT_SHORTCUTS.prev).handler();
 assert.equal(scroll.scrollTop,anchors[0].row);
 await shortcuts.get(extension.PROMPT_SHORTCUTS.next).handler();
 assert.equal(scroll.scrollTop,anchors[1].row);
 assert.equal(focusChanges,0);
 hooks.get('session_shutdown')(); widget?.dispose();
 assert.equal(currentRoot,original);
} finally {
 previousAgent===undefined?delete process.env.PI_CODING_AGENT_DIR:process.env.PI_CODING_AGENT_DIR=previousAgent;
 rmSync(shortcutDir,{recursive:true,force:true});
}
// Exercise menu and commands with isolated temporary preferences.
const preferenceDir=mkdtempSync(join(tmpdir(),'pi-prompt-jump-menu-'));
process.env.PI_CODING_AGENT_DIR=preferenceDir;
try {
 const extension=await jiti.import(new URL('./index.ts',import.meta.url).pathname);
 const preference=`${preferenceDir}/pi-prompt-jump.json`;
 const saved=()=>JSON.parse(readFileSync(preference,'utf8')).enabled;
 function runtime(renderer=tui) {
  const commands=new Map(), hooks=new Map(), notifications=[], menus=[];
  let choice, widget, widgetCalls=0;
  const api={getCommands:()=>[],on:(event,handler)=>hooks.set(event,handler),registerCommand:(name,definition)=>commands.set(name,definition),registerShortcut(){}};
  // Any new execution/model/history API calls fail instead of being silently mocked.
  extension.default(new Proxy(api,{get:(target,key)=>{assert.ok(key in target,`Unexpected API: ${String(key)}`);return target[key];}}));
  const ctx={mode:'tui',hasUI:true,ui:{
   notify:(message,type)=>notifications.push({message,type}),
   select:async(title,options)=>{menus.push({title,options});return choice?.(options);},
   setWidget:(_key,factory)=>{widgetCalls++;widget?.dispose();widget=factory?.(renderer,theme);},
  }};
  return {ctx,hooks,notifications,menus,command:args=>commands.get('sticky-prompt').handler(args,ctx),jump:args=>commands.get('prompt-jump').handler(args,ctx),choose:fn=>{choice=fn;},get widgetCalls(){return widgetCalls;}};
 }
 currentRoot=original;
 const active=runtime(); active.hooks.get('session_start')({},active.ctx);
 const mountedRoot=currentRoot;
 assert.notEqual(mountedRoot,original);
 // Exercise the actual picker and reject dialogs that outlive branch changes.
 const beforePicker=scroll.scrollTop;
 await active.jump('list'); // Cancel keeps the viewport unchanged.
 assert.equal(scroll.scrollTop,beforePicker);
 assert.equal(active.menus.pop().title,'Jump to prompt (scroll only)');
 active.choose(options=>options[1]); await active.jump('list');
 assert.equal(scroll.scrollTop,anchors[1].row); active.menus.pop();
 active.choose(options=>{active.hooks.get('session_tree')();return options[0];});
 await active.jump('list'); assert.equal(scroll.scrollTop,anchors[1].row); active.menus.pop();
 active.choose(options=>{active.hooks.get('session_switch')({},active.ctx);return options[0];});
 await active.jump('list'); assert.equal(scroll.scrollTop,anchors[1].row); active.menus.pop();
 await active.jump('invalid'); assert.equal(active.notifications.pop().type,'warning');
 active.choose(undefined);
 const scrollBefore={top:scroll.scrollTop,following:scroll.isFollowingEnd};
 await active.command(''); // Cancel: no preference, layout, or notification changes.
 assert.match(active.menus[0].title,/preference: On; mounted in fullscreen/);
 assert.deepEqual(active.menus[0].options,['On (current preference)','Off']);
 assert.equal(currentRoot,mountedRoot); assert.equal(existsSync(preference),false);
 assert.equal(active.notifications.length,0); assert.equal(active.widgetCalls,1);
 active.choose(options=>options[1]); await active.command('   ');
 assert.equal(saved(),false); assert.equal(currentRoot,original);
 await active.command('status'); assert.match(active.notifications.at(-1).message,/preference: disabled; not mounted/);
 const disabled=runtime(); disabled.hooks.get('session_start')({},disabled.ctx);
 assert.equal(disabled.widgetCalls,0); // Persisted Off survives extension recreation.
 await disabled.command('');
 assert.deepEqual(disabled.menus.at(-1).options,['On','Off (current preference)']);
 assert.equal(saved(),false); assert.equal(currentRoot,original);
 disabled.choose(options=>options[0]); await disabled.command('');
 assert.equal(saved(),true); assert.notEqual(currentRoot,original); // Accessible while disabled.
 const menusBefore=disabled.menus.length;
 await disabled.command(' off '); assert.equal(saved(),false); assert.equal(currentRoot,original);
 await disabled.command('on'); assert.equal(saved(),true); assert.notEqual(currentRoot,original);
 await disabled.command('status'); assert.match(disabled.notifications.at(-1).message,/preference: enabled; mounted in fullscreen/);
 await disabled.command('invalid'); assert.equal(disabled.notifications.at(-1).type,'warning');
 assert.equal(disabled.menus.length,menusBefore); assert.equal(saved(),true);
 assert.deepEqual({top:scroll.scrollTop,following:scroll.isFollowingEnd},scrollBefore);
 assert.equal(focusChanges,0);
 disabled.hooks.get('session_shutdown')(); assert.equal(currentRoot,original);
 const reloaded=runtime(); reloaded.hooks.get('session_start')({},reloaded.ctx);
 assert.notEqual(currentRoot,original); // Persisted On survives extension recreation.
 reloaded.hooks.get('session_shutdown')(); assert.equal(currentRoot,original);
 // A failed preference save must not change the live layout or enabled state.
 process.env.PI_CODING_AGENT_DIR=preference; // An existing file cannot become a directory.
 const failedSave=runtime(); failedSave.hooks.get('session_start')({},failedSave.ctx);
 const failedRoot=currentRoot;
 await assert.rejects(failedSave.command('off'));
 assert.equal(currentRoot,failedRoot);
 await failedSave.command('status');
 assert.match(failedSave.notifications.at(-1).message,/preference: enabled; mounted/);
 failedSave.hooks.get('session_shutdown')(); assert.equal(currentRoot,original);
 process.env.PI_CODING_AGENT_DIR=preferenceDir;
 const regular=runtime({...tui,mode:'regular'}); regular.hooks.get('session_start')({},regular.ctx);
 await regular.command(''); assert.match(regular.menus.at(-1).title,/preference: On; not mounted/);
 regular.choose(options=>options[0]); await regular.command('');
 assert.equal(saved(),true); assert.equal(currentRoot,original);
 assert.match(regular.notifications.at(-1).message,/unavailable/);
 regular.hooks.get('session_shutdown')();
 for(const [mode,hasUI] of [['rpc',true],['json',false],['print',false],['tui',false]]) {
  const headless=runtime(); headless.ctx.mode=mode; headless.ctx.hasUI=hasUI;
  headless.ctx.ui.select=()=>{assert.fail('Must not request a dialog without interactive TUI');};
  headless.hooks.get('session_start')({},headless.ctx);
  assert.equal(headless.widgetCalls,0);
  await headless.jump('list');
  assert.equal(headless.notifications.at(-1).type,'warning');
  await headless.command(''); await headless.command('status');
  assert.match(headless.notifications.at(-1).message,/preference: enabled; not mounted/);
  assert.equal(headless.widgetCalls,0); assert.equal(saved(),true);
  if(mode!=='tui') {
   await headless.command('off'); assert.equal(saved(),false);
   await headless.command('on'); assert.equal(saved(),true);
   assert.equal(headless.widgetCalls,0); assert.equal(currentRoot,original);
  }
 }
} finally {
 previousAgent===undefined?delete process.env.PI_CODING_AGENT_DIR:process.env.PI_CODING_AGENT_DIR=previousAgent;
 rmSync(preferenceDir,{recursive:true,force:true}); // Only this test's own temporary files.
}
// Standalone prompt-template helper, including conservative matching and precedence.
const templateDir=mkdtempSync(join(tmpdir(),'pi-prompt-jump-templates-'));
try {
 const {templateMatchers,matchingTemplate}=await jiti.import(new URL('./templates.ts',import.meta.url).pathname);
 const prefix='Review this example carefully and explain the assumptions: ';
 const exactBody='A standalone prompt template with a sufficiently distinctive fixed prefix.';
 const make=(name,body)=>{
  const path=join(templateDir,`${name}.md`); writeFileSync(path,body);
  return {name,source:'prompt',sourceInfo:{path}};
 };
 const commands=[
  make('exact',`---\ndescription: Test fixture\n---\n${exactBody}\n`),
  make('dynamic',`${prefix}$1\nThen compare: \${2:-default}\nEnd of template.`),
  make('short','Say $1'), make('only-arguments','$ARGUMENTS'),
  make('oversized','x'.repeat(100001)),
  {name:'missing',source:'prompt',sourceInfo:{path:join(templateDir,'absent.md')}},
 ];
 const matchers=templateMatchers(commands);
 assert.deepEqual(matchers.map(t=>t.name),['exact','dynamic']);
 assert.equal(matchingTemplate(`  ${exactBody}\n`,matchers),'exact');
 assert.equal(matchingTemplate(`${exactBody} unrelated`,matchers),undefined);
 assert.equal(matchingTemplate(`${prefix}one\nThen compare: two\nEnd of template.`,matchers),'dynamic');
 assert.equal(matchingTemplate(`${prefix}one\nWrong fixed segment\nEnd of template.`,matchers),undefined);
 assert.equal(matchingTemplate('x'.repeat(200001),matchers),undefined);
 const shadowed=templateMatchers([...commands,{name:'exact',source:'extension'}]);
 assert.equal(shadowed.some(t=>t.name==='exact'),false);
 const labeled=nav.collectPrompts(new UserMessageComponent(exactBody,getMarkdownTheme(),1),80,
  text=>{const name=matchingTemplate(text,matchers);return name?`/${name}`:undefined;});
 assert.equal(labeled.anchors[0].label,'/exact');
} finally { rmSync(templateDir,{recursive:true,force:true}); }
console.log('PASS: standalone template labels/precedence, prompt picker cancellation and branch invalidation, failed-save consistency, no-UI lifecycle guards; On/Off menu, cancellation, explicit commands, persisted preferences, original layout and safe no-UI/RPC status; Option+Shift+arrow registration/terminal decoding and actual shortcut handlers; real Pi light/dark/system themes, truecolor/256-color styling and theme switching, preceding prompt selection, between-prompt scrolling, actual user/skill render heights, resize/Unicode/ANSI, one-row strip, click without focus steal, prev/next/back/end, tree reset, reload/restore and incompatible-mode guards');
