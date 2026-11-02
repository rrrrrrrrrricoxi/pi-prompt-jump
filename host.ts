import * as host from "@earendil-works/pi-coding-agent";
import * as ui from "@earendil-works/pi-tui";
import type { Component, TUI } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";

// Check the seam we use, not the release label. These shapes are integration
// details, so passing this check does not guarantee compatibility with future Pi.
export function hostUnavailableReason(tui: TUI, theme: Theme): string | undefined {
  for (const [name, methods] of [
    ["UserMessageComponent", ["render", "rebuild"]],
    ["SkillInvocationMessageComponent", ["render", "setExpanded"]],
  ] as const) {
    const prototype = (host[name] as any)?.prototype;
    if (typeof host[name] !== "function" || !methods.every(key => typeof prototype?.[key] === "function"))
      return `missing native ${name} capabilities`;
  }
  for (const name of ["Container", "Spacer", "ScrollView", "VStack"] as const) {
    if (typeof ui[name] !== "function" || typeof ui[name]?.prototype?.render !== "function")
      return `missing UI ${name} capability`;
  }
  for (const name of ["isViewportTUI", "parseColor", "truncateToWidth", "visibleWidth"] as const) {
    if (typeof ui[name] !== "function") return `missing UI ${name} capability`;
  }
  if (tui.mode !== "fullscreen") return "requires fullscreen mode";
  if (!ui.isViewportTUI(tui)) return "requires a viewport renderer";
  for (const name of ["getMountedRoots", "setLayoutRoot", "requestRender"] as const) {
    if (typeof (tui as any)[name] !== "function") return `missing renderer ${name} capability`;
  }
  if (!Number.isFinite(tui.terminal?.columns) || tui.terminal.columns < 1) return "missing terminal width";
  if (typeof theme?.style !== "function" || !["light", "dark"].includes(theme.appearance)) return "unsupported theme shape";
}
export function userText(component: Component): string | undefined {
  const card = component as any;
  return typeof host.UserMessageComponent === "function" && component instanceof host.UserMessageComponent &&
    typeof card.text === "string" ? card.text : undefined;
}
export function skillBlock(component: Component): { name: string; userMessage?: string } | undefined {
  const block = (component as any).skillBlock;
  return typeof host.SkillInvocationMessageComponent === "function" && component instanceof host.SkillInvocationMessageComponent &&
    typeof block?.name === "string" && typeof block.content === "string" &&
    (block.userMessage === undefined || typeof block.userMessage === "string") ? block : undefined;
}
export function containerChildren(component: Component): Component[] | undefined {
  // Subclasses can add spacing or renderer groups. Measure them as one unit.
  if (typeof ui.Container !== "function" || component.constructor !== ui.Container) return undefined;
  // Fold's visible tree owns indentation and collapsed rows; canonical children
  // are retained for session history and must not be measured at another width.
  const projected = (component as any)[Symbol.for("compact-renderer:projected-children:v1")];
  const children = Array.isArray(projected) ? projected : (component as any).children;
  return Array.isArray(children) ? children : undefined;
}
