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
  let unavailableReason = "use on to attempt a fullscreen mount";
  try { enabled = JSON.parse(readFileSync(preference, "utf8")).enabled !== false; } catch { /* UI-only default. */ }
  let controller: ReturnType<typeof installStrip>;
  let templates: ReturnType<typeof templateMatchers> = [];
  const clean = () => { controller?.dispose(); controller = undefined; };
  function mount(ctx: ExtensionContext) {
    templates = templateMatchers(pi.getCommands());
    if (!enabled) { unavailableReason = "preference is disabled"; return; }
    if (ctx.mode !== "tui" || !ctx.hasUI) { unavailableReason = "requires an interactive fullscreen UI"; return; }
    ctx.ui.setWidget("pi-prompt-jump-bootstrap", (tui, theme) => {
      clean();
      // Mounted roots and native prompt-component shapes are integration details.
      // All layout changes use public setLayoutRoot/ScrollView APIs; no Pi files are patched.
      controller = installStrip(tui, theme, text => {
        const template = matchingTemplate(text, templates);
        return template ? `/${template}` : undefined;
      }, reason => { unavailableReason = reason; });
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
  pi.registerCommand("prompt-jump", {
    description: "[on | off | status | list]",
    getArgumentCompletions: async prefix => ["on", "off", "status", "list"]
      .filter(value => value.startsWith(prefix)).map(value => ({ value, label: value })),
    handler: async (args, ctx) => {
      const action = args.trim();
      const usage = "Usage: /prompt-jump [on | off | status | list]";
      if (!["on", "off", "status", "list"].includes(action)) {
        ctx.ui.notify(usage, action ? "warning" : "info"); return;
      }
      const mountStatus = () => controller?.mounted ? "mounted in fullscreen" : `not mounted (${controller ? "layout was replaced; use on to remount" : enabled ? unavailableReason : "preference is disabled"})`;
      if (action === "status") {
        ctx.ui.notify(`Prompt Jump preference: ${enabled ? "enabled" : "disabled"}; ${mountStatus()}. Shortcuts: Option+Shift+↑ / ↓.`, "info");
        return;
      }
      if (["on", "off"].includes(action)) {
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
        ctx.ui.notify(enabled ? controller?.mounted ? "Prompt Jump strip enabled." : `Prompt Jump strip unavailable: ${unavailableReason}.` : "Prompt Jump strip disabled; original layout restored.", "info");
        return;
      }
      if (ctx.mode !== "tui" || !ctx.hasUI || !controller?.mounted) {
        ctx.ui.notify(`Prompt navigation unavailable: ${mountStatus()}. Use /prompt-jump on in fullscreen.`, "warning"); return;
      }
      if (action === "list") {
        const active = controller;
        const generation = active.generation;
        const choices = active.prompts().map((prompt, i) => `${i + 1}. ${firstLine(prompt.label).slice(0, 140)}`);
        if (!choices.length) { ctx.ui.notify("No text prompts in this displayed branch.", "info"); return; }
        const selected = await ctx.ui.select("Jump to prompt (scroll only)", choices);
        if (selected && controller?.mounted && controller === active && controller.generation === generation) controller.jumpTo(choices.indexOf(selected));
        return;
      }
    },
  });
  pi.registerShortcut(PROMPT_SHORTCUTS.prev, { description: "Jump to previous user prompt", handler: async () => { if (controller?.mounted) controller.navigate("prev"); } });
  pi.registerShortcut(PROMPT_SHORTCUTS.next, { description: "Jump to next user prompt", handler: async () => { if (controller?.mounted) controller.navigate("next"); } });
}
