// Test-only, deterministic streaming fixture. Never loaded by the package manifest.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai/compat";
import { ScrollView, type Component } from "@earendil-works/pi-tui";
import { writeFileSync } from "node:fs";

export default function (pi: ExtensionAPI) {
  pi.registerProvider("smoke-fixture", {
    api: "smoke-fixture-stream",
    apiKey: "offline-test-placeholder-not-a-credential",
    baseUrl: "https://invalid.invalid",
    models: [{ id: "fixture", name: "Offline deterministic fixture", reasoning: false,
      input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 1000000, maxTokens: 4096 }],
    streamSimple(model, _context, options) {
      const stream = createAssistantMessageEventStream();
      const message: any = { role: "assistant", content: [{ type: "text", text: "" }],
        api: model.api, provider: model.provider, model: model.id, timestamp: Date.now(),
        stopReason: "stop", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0,
          totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
      void (async () => {
        stream.push({ type: "start", partial: message });
        stream.push({ type: "text_start", contentIndex: 0, partial: message });
        for (let i = 0; i < 35; i++) {
          await new Promise(resolve => setTimeout(resolve, 30));
          if (options?.signal?.aborted) {
            message.stopReason = "aborted"; message.errorMessage = "Fixture aborted";
            stream.push({ type: "error", reason: "aborted", error: message }); stream.end(); return;
          }
          const delta = `Synthetic response line ${i + 1}: deterministic content for scrolling.\n`;
          message.content[0].text += delta;
          stream.push({ type: "text_delta", contentIndex: 0, delta, partial: message });
        }
        stream.push({ type: "text_end", contentIndex: 0, content: message.content[0].text, partial: message });
        stream.push({ type: "done", reason: "stop", message }); stream.end();
      })();
      return stream;
    },
  });

  let removeListener: (() => void) | undefined;
  let sequence = 0;
  const instance = crypto.randomUUID();
  const mount = (_event: unknown, ctx: any) => {
    ctx.ui.setWidget("smoke-test-probe", (tui: any) => {
      removeListener?.();
      const snapshot = () => {
        const root = tui.getMountedRoots?.()[0];
        const control = root?.[Symbol.for("notrico/sticky-prompt-strip/owner")];
        const scrolls: ScrollView[] = [];
        const walk = (component: Component & { children?: Component[] }) => {
          if (component instanceof ScrollView && component.primary) { scrolls.push(component); return; }
          for (const child of component.children || []) walk(child);
        };
        if (root) walk(root);
        const scroll = scrolls[0];
        const anchors = control?.prompts() || [];
        writeFileSync(process.env.PI_SMOKE_SNAPSHOT!, JSON.stringify({
          instance, sequence: ++sequence, mounted: !!control?.mounted, roots: tui.getMountedRoots?.().length,
          top: scroll?.scrollTop, following: scroll?.isFollowingEnd,
          viewportHeight: scroll?.viewportHeight, anchors,
          strip: control?.strip.render(tui.terminal.columns)[0] || "",
          focus: tui.getFocusedComponent?.()?.constructor.name,
          editor: ctx.ui.getEditorText(), idle: ctx.isIdle(),
          sessionId: ctx.sessionManager.getSessionId(),
        }));
      };
      removeListener = tui.addInputListener((data: string) => {
        if (data === "\x1b[24~") { snapshot(); return { consume: true }; }
      });
      return { render: () => [], invalidate() {}, dispose() { removeListener?.(); removeListener = undefined; } };
    });
  };
  pi.on("session_start", mount);
  pi.on("session_shutdown", () => { removeListener?.(); removeListener = undefined; });
}
