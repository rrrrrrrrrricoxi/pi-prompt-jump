import { Spacer, type Component } from "@earendil-works/pi-tui";

import { containerChildren, skillBlock, userText } from "./host.ts";
export type PromptAnchor = { row: number; end: number; text: string; label: string };
export function firstLine(text: string): string {
  return text.trimStart().split(/\r?\n/, 1)[0]
    .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\x00-\x1f\x7f]/g, " ").trim() || "[empty prompt]";
}

// Use actual rendered heights, so wrapping and compact/expanded tools do not break targets.
export function collectPrompts(document: Component, width: number, labelFor: (text: string) => string | undefined = () => undefined): { anchors: PromptAnchor[]; height: number } {
  const anchors: PromptAnchor[] = [];
  let row = 0;
  function visit(component: Component) {
    const text = userText(component);
    const skill = skillBlock(component);
    if (text !== undefined) {
      const height = component.render(width).length;
      anchors.push({ row, end: row + height, text, label: firstLine(labelFor(text) || text) });
      row += height;
      return;
    }
    if (skill) {
      const height = component.render(width).length;
      const text = `/skill:${skill.name}`;
      anchors.push({ row, end: row + height, text, label: firstLine(text) });
      row += height;
      return;
    }
    // Only recurse through plain Containers: Box/Stack padding and gaps have their own height.
    const children = containerChildren(component);
    if (children) {
      let skipSkillArguments = false;
      for (const child of children) {
        if (skipSkillArguments && child instanceof Spacer) {
          row += child.render(width).length;
          continue;
        }
        if (skipSkillArguments && userText(child) !== undefined) {
          row += child.render(width).length;
          skipSkillArguments = false;
          continue;
        }
        skipSkillArguments = false;
        visit(child);
        if (skillBlock(child)?.userMessage) skipSkillArguments = true;
      }
      return;
    }
    row += component.render(width).length;
  }
  visit(document);
  return { anchors, height: row };
}
export function precedingPrompt(anchors: PromptAnchor[], top: number): PromptAnchor | undefined {
  let result: PromptAnchor | undefined;
  for (const anchor of anchors) {
    if (anchor.row > top) break;
    result = anchor;
  }
  return result;
}
export function navigationTarget(anchors: PromptAnchor[], top: number, action: string): PromptAnchor | undefined {
  if (action === "current") return precedingPrompt(anchors, top);
  if (action === "last") return anchors.at(-1);
  if (action === "next") return anchors.find(anchor => anchor.row > top);
  if (action === "prev") return [...anchors].reverse().find(anchor => anchor.row < top);
  return undefined;
}
