import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { installStrip } from "./controller.ts";
import { firstLine } from "./navigation.ts";
import { templateMatchers, matchingTemplate } from "./templates.ts";

export const PROMPT_SHORTCUTS = { prev: "alt+shift+up", next: "alt+shift+down" } as const;

export default function promptJump(pi: ExtensionAPI) {
  const preference = join(process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent"), "pi-prompt-jump.json");
  let enabled = true;
  try { enabled = JSON.parse(readFileSync(preference, "utf8")).enabled !== false; } catch { /* UI-only default. */ }
  let controller: ReturnType<typeof installStrip>;
  let templates: ReturnType<typeof templateMatchers> = [];
  const clean = () => { controller?.dispose(); controller = undefined; };
  function mount(ctx: ExtensionContext) {
    templates = templateMatchers(pi.getCommands());
    if (ctx.mode !== "tui" || !ctx.hasUI || !enabled) return;
    ctx.ui.setWidget("pi-prompt-jump-bootstrap", (tui, theme) => {
      clean();
      // getMountedRoots and the two prompt-component shapes are version-specific inspection.
      // All layout changes use public setLayoutRoot/ScrollView APIs; no Pi files are patched.
      controller = installStrip(tui, theme, text => {
        const template = matchingTemplate(text, templates);
        return template ? `/${template}` : undefined;
      });
      return { render: () => [], invalidate() {}, dispose: clean };
    });
  }
  pi.on("session_start", (_event, ctx) => mount(ctx));
  pi.on("session_switch", (_event, ctx) => {
    templates = templateMatchers(pi.getCommands());
    controller?.reset();
  });
  pi.on("session_tree", () => controller?.reset());
  pi.on("session_shutdown", clean);
  pi.registerCommand("sticky-prompt", {
    description: "Sticky prompt strip: On/Off menu, or on | off | status (fullscreen Pi 1.3.0)",
    handler: async (args, ctx) => {
      let action = args.trim();
      const mountStatus = () => controller?.mounted ? "mounted in fullscreen" : "not mounted (requires Pi 1.3.0 fullscreen; use on after a renderer remount)";
      if (!action && ctx.mode === "tui" && ctx.hasUI) {
        const choices = [enabled ? "On (current preference)" : "On", enabled ? "Off" : "Off (current preference)"];
        const selected = await ctx.ui.select(`Sticky prompt — preference: ${enabled ? "On" : "Off"}; ${mountStatus()}`, choices);
        if (selected === undefined) return;
        const index = choices.indexOf(selected);
        if (index < 0) return;
        action = index === 0 ? "on" : "off";
      }
      if (!action || action === "status") {
        ctx.ui.notify(`Sticky prompt preference: ${enabled ? "enabled" : "disabled"}; ${mountStatus()}. Shortcuts: Option+Shift+↑ / ↓.`, "info");
        return;
      }
      if (!["on", "off"].includes(action)) { ctx.ui.notify("Usage: /sticky-prompt on | off | status", "warning"); return; }
      const nextEnabled = action === "on";
      mkdirSync(dirname(preference), { recursive: true });
      const temporary = `${preference}.${process.pid}.tmp`;
      writeFileSync(temporary, JSON.stringify({ enabled: nextEnabled }, null, 2) + "\n", { mode: 0o600 });
      renameSync(temporary, preference);
      // Do not change live state if saving the preference fails.
      enabled = nextEnabled;
      clean();
      if (ctx.mode === "tui" && ctx.hasUI) ctx.ui.setWidget("pi-prompt-jump-bootstrap", undefined);
      if (enabled) mount(ctx);
      ctx.ui.notify(enabled ? controller?.mounted ? "Sticky prompt strip enabled." : "Sticky prompt strip unavailable in this renderer/version." : "Sticky prompt strip disabled; original layout restored.", "info");
    },
  });
  pi.registerCommand("prompt-jump", {
    description: "Scroll only: current | prev | next | last | back | end | list",
    handler: async (args, ctx) => {
      if (ctx.mode !== "tui" || !ctx.hasUI || !controller?.mounted) { ctx.ui.notify("Enable the strip with /sticky-prompt on in fullscreen Pi 1.3.0.", "warning"); return; }
      const action = args.trim() || "current";
      if (action === "list") {
        const active = controller;
        const generation = active.generation;
        const choices = active.prompts().map((prompt, i) => `${i + 1}. ${firstLine(prompt.label).slice(0, 140)}`);
        if (!choices.length) { ctx.ui.notify("No text prompts in this displayed branch.", "info"); return; }
        const selected = await ctx.ui.select("Jump to prompt (scroll only)", choices);
        if (selected && controller?.mounted && controller === active && controller.generation === generation) controller.jumpTo(choices.indexOf(selected));
        return;
      }
      if (!["current", "prev", "next", "last", "back", "end"].includes(action)) {
        ctx.ui.notify("Usage: /prompt-jump current | prev | next | last | back | end | list", "warning"); return;
      }
      if (!controller.navigate(action)) ctx.ui.notify("No prompt/return position in that direction.", "info");
    },
  });
  pi.registerShortcut(PROMPT_SHORTCUTS.prev, { description: "Jump to previous user prompt", handler: async () => { if (controller?.mounted) controller.navigate("prev"); } });
  pi.registerShortcut(PROMPT_SHORTCUTS.next, { description: "Jump to next user prompt", handler: async () => { if (controller?.mounted) controller.navigate("next"); } });
}
