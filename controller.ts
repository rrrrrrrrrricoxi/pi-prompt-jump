import { ScrollView, VStack, isViewportTUI, parseColor, truncateToWidth, visibleWidth, type Component, type TUI } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { supportsHost } from "./host.ts";
import { collectPrompts, precedingPrompt, navigationTarget, type PromptAnchor } from "./navigation.ts";

// theme.style() treats strings as semantic tokens, not CSS colors. Parse once, outside rendering.
const stripColors = {
  light: { fg: parseColor("#454545"), bg: parseColor("#e4e4e4") },
  dark: { fg: parseColor("#c8c8c8"), bg: parseColor("#303238") },
};

type MountedTUI = TUI & { getMountedRoots?: () => readonly Component[] };
export function installStrip(tui: TUI, theme: Theme, labelFor: (text: string) => string | undefined = () => undefined, version?: string) {
  if (!supportsHost(version) || tui.mode !== "fullscreen" || !isViewportTUI(tui)) return undefined;
  const mounted = () => (tui as MountedTUI).getMountedRoots?.();
  const ownerKey = Symbol.for("notrico/sticky-prompt-strip/owner");
  let roots = mounted();
  const previous = roots?.[0] as any;
  if (previous?.[ownerKey]?.dispose) { previous[ownerKey].dispose(); roots = mounted(); }
  if (!roots || roots.length !== 1 || !(roots[0] instanceof VStack)) return undefined;
  const original = roots[0];
  const scrolls: ScrollView[] = [];
  function find(component: Component) {
    if (component instanceof ScrollView && component.primary) { scrolls.push(component); return; }
    const children = (component as {children?:Component[]}).children;
    for (const child of Array.isArray(children) ? children : []) find(child);
  }
  find(original);
  if (scrolls.length !== 1) return undefined;
  const scroll = scrolls[0];
  const document = scroll.children[0];
  if (!document || typeof document.render !== "function" ||
      !["getContentWidth", "scrollTo", "scrollToEnd"].every(key => typeof (scroll as any)[key] === "function") ||
      typeof tui.setLayoutRoot !== "function" || typeof tui.requestRender !== "function") return undefined;
  let disposed = false;
  let generation = 0;
  let bookmark: { top: number; following: boolean } | undefined;
  let anchors: PromptAnchor[] = [];
  let top = 0;
  function snapshot(width = tui.terminal.columns) {
    const collected = collectPrompts(document, scroll.getContentWidth(Math.max(1, width)), labelFor);
    anchors = collected.anchors;
    top = scroll.isFollowingEnd ? Math.max(0, collected.height - scroll.viewportHeight) : scroll.scrollTop;
    return anchors;
  }
  function jump(target: PromptAnchor | undefined) {
    if (!target || disposed) return false;
    bookmark = { top: scroll.scrollTop, following: scroll.isFollowingEnd };
    scroll.scrollTo(target.row, { disableFollow: true });
    tui.requestRender();
    return true;
  }
  const strip: Component = {
    render(width) {
      if (disposed) return [];
      snapshot(width);
      const current = precedingPrompt(anchors, top);
      const number = current ? anchors.indexOf(current) + 1 : 0;
      const text = current ? ` ↥ Prompt ${number}/${anchors.length} · ${current.label}  [click to jump]` : " Prompts · scroll into the conversation · /prompt-jump list";
      const line = truncateToWidth(text, Math.max(1, width), "…");
      return [theme.style(line + " ".repeat(Math.max(0, width - visibleWidth(line))), stripColors[theme.appearance])];
    },
    invalidate() {},
    handleMouse(event) {
      if (event.type !== "click" || event.button !== "left") return undefined;
      snapshot();
      jump(precedingPrompt(anchors, top));
      return { handled: true }; // No focus request: the editor retains keyboard focus.
    },
  };
  const wrapper = new VStack([
    { component: strip, basis: 1, minSize: 1, maxSize: 1, shrink: 0, visible: viewport => viewport.height >= 8 },
    { component: original, basis: 0, grow: 1, shrink: 1, minSize: 1 },
  ]);
  tui.setLayoutRoot(wrapper);
  tui.requestRender();
  const control = {
    strip,
    get generation() { return generation; },
    get mounted() { return !disposed && mounted()?.[0] === wrapper; },
    prompts() { return snapshot(); },
    navigate(action: string) {
      snapshot();
      if (action === "end") { scroll.scrollToEnd(); tui.requestRender(); return true; }
      if (action === "back") {
        if (!bookmark) return false;
        const previous = bookmark; bookmark = undefined;
        if (previous.following) scroll.scrollToEnd(); else scroll.scrollTo(previous.top, { disableFollow: true });
        tui.requestRender(); return true;
      }
      return jump(navigationTarget(anchors, top, action));
    },
    jumpTo(index: number) { snapshot(); return jump(anchors[index]); },
    reset() { generation++; bookmark = undefined; anchors = []; },
    dispose() {
      if (disposed) return;
      disposed = true; generation++; bookmark = undefined;
      // Never overwrite another extension's replacement root or a renderer remount.
      if (mounted()?.[0] === wrapper) tui.setLayoutRoot(original);
      tui.requestRender();
    },
  };
  (wrapper as any)[ownerKey] = control;
  return control;
}
