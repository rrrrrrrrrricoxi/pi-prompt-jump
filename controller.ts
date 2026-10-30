import * as ui from "@earendil-works/pi-tui";
import type { Component, TUI, ScrollView } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { hostUnavailableReason } from "./host.ts";
import { collectPrompts, precedingPrompt, navigationTarget, type PromptAnchor } from "./navigation.ts";

type MountedTUI = TUI & { getMountedRoots: () => readonly Component[] };
export function installStrip(tui: TUI, theme: Theme, labelFor: (text: string) => string | undefined = () => undefined,
  onUnavailable: (reason: string) => void = () => {}) {
  const unavailable = (reason: string) => { onUnavailable(reason); return undefined; };
  const reason = hostUnavailableReason(tui, theme);
  if (reason) return unavailable(reason);
  const { ScrollView, VStack, parseColor, truncateToWidth, visibleWidth } = ui;
  const mounted = () => (tui as MountedTUI).getMountedRoots();
  const ownerKey = Symbol.for("notrico/sticky-prompt-strip/owner");
  let roots = mounted();
  const previous = roots?.[0] as any;
  if (previous?.[ownerKey]?.dispose) { previous[ownerKey].dispose(); roots = mounted(); }
  if (!Array.isArray(roots) || roots.length !== 1 || !(roots[0] instanceof VStack)) return unavailable("requires one native VStack layout root");
  const original = roots[0];
  const scrolls: ScrollView[] = [];
  let invalidTree = false;
  function find(component: Component) {
    if (!component || typeof component.render !== "function") { invalidTree = true; return; }
    if (component instanceof ScrollView && component.primary) { scrolls.push(component); return; }
    const children = (component as {children?:Component[]}).children;
    for (const child of Array.isArray(children) ? children : []) find(child);
  }
  find(original);
  if (invalidTree) return unavailable("unsupported layout component shape");
  if (scrolls.length !== 1) return unavailable("requires one primary chat ScrollView");
  const scroll = scrolls[0];
  const document = Array.isArray(scroll.children) && scroll.children.length === 1 ? scroll.children[0] : undefined;
  if (!document || typeof document.render !== "function" ||
      !["getContentWidth", "scrollTo", "scrollToEnd"].every(key => typeof (scroll as any)[key] === "function") ||
      !Number.isFinite(scroll.scrollTop) || !Number.isFinite(scroll.viewportHeight) ||
      typeof scroll.isFollowingEnd !== "boolean") return unavailable("unsupported chat ScrollView shape");
  // Parse only after capability checks, so missing exports cannot crash startup.
  const stripColors = {
    light: { fg: parseColor("#454545"), bg: parseColor("#e4e4e4") },
    dark: { fg: parseColor("#c8c8c8"), bg: parseColor("#303238") },
  };
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
