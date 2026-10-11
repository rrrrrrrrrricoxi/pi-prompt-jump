import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";

type SlashCommandInfo = ReturnType<ExtensionAPI["getCommands"]>[number];
type Template = { name: string; parts: string[] };

const placeholders = /\$\{(?:\d+|ARGUMENTS|@):-[^}]*\}|\$\{@:\d+(?::\d+)?\}|\$(?:ARGUMENTS|@|\d+)/g;

export function templateMatchers(commands: SlashCommandInfo[]): Template[] {
  const templates: Template[] = [];
  for (const command of commands) {
    if (command.source !== "prompt") continue;
    // Follow Pi's command precedence: extension commands take priority over templates.
    if (commands.some(other => other.source === "extension" && other.name === command.name)) continue;
    try {
      const raw = readFileSync(command.sourceInfo.path, "utf8");
      if (raw.length > 100000) continue;
      const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "").trim();
      const parts = body.split(placeholders);
      // Require a distinctive fixed prefix. Dynamic-only/short prompts stay visible.
      if (parts[0].length < 40 || parts.length > 33) continue;
      templates.push({ name: command.name, parts });
    } catch { /* Resource missing/changed: leave its messages fully visible. */ }
  }
  return templates;
}

export function matchingTemplate(text: string, templates: Template[]): string | undefined {
  const value = text.trim();
  if (value.length > 200000) return undefined;
  for (const { name, parts } of templates) {
    if (parts.length === 1) {
      if (value === parts[0]) return name;
      continue;
    }
    // Trim at the outer message edges only. No regex wildcards/backtracking over large prompts.
    const first = parts[0].trimStart();
    const last = parts.at(-1)!.trimEnd();
    if (!value.startsWith(first.trimEnd()) || (last && !value.endsWith(last))) continue;
    let position = Math.min(first.length, value.length);
    let matches = true;
    for (const part of parts.slice(1, -1)) {
      const next = value.indexOf(part, position);
      if (next < 0) { matches = false; break; }
      position = next + part.length;
    }
    if (matches && (!last || position <= value.length - last.length)) return name;
  }
  return undefined;
}

