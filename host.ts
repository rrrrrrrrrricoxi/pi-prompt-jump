import { SkillInvocationMessageComponent, UserMessageComponent, VERSION } from "@earendil-works/pi-coding-agent";
import { Container, type Component } from "@earendil-works/pi-tui";

// This seam is verified against Pi 1.3.0's native user/skill cards and chat viewport.
// Unknown hosts keep their original layout; unknown cards keep their rendered height.
export const SUPPORTED_PI_VERSION = "1.3.0";
export function supportsHost(version = VERSION): boolean {
  return version === SUPPORTED_PI_VERSION &&
    typeof UserMessageComponent.prototype.render === "function" &&
    typeof (UserMessageComponent.prototype as any).rebuild === "function" &&
    typeof SkillInvocationMessageComponent.prototype.setExpanded === "function";
}
export function userText(component: Component): string | undefined {
  const card = component as any;
  return component instanceof UserMessageComponent && typeof card.text === "string" ? card.text : undefined;
}
export function skillBlock(component: Component): { name: string; userMessage?: string } | undefined {
  const block = (component as any).skillBlock;
  return component instanceof SkillInvocationMessageComponent && typeof block?.name === "string" &&
    typeof block.content === "string" ? block : undefined;
}
export function containerChildren(component: Component): Component[] | undefined {
  // Subclasses may add padding, spacing, or renderer groups. Treat those as one
  // rendered unit so their final compact/expanded height controls subsequent rows.
  return component.constructor === Container && Array.isArray((component as any).children)
    ? (component as any).children : undefined;
}
