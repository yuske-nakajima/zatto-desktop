import { createHtmlFileDropShieldStyles } from "./html-file-drop-shield-styles";

const SHIELD_ID = "zatto-desktop-drop-shield";
const COUNT_ID = "zatto-desktop-drop-count";
const ACTIVE_ATTRIBUTE = "data-zatto-desktop-drop";

/** Visual states controlled by the Finder file-drop workflow. */
export interface HtmlFileDropShield {
  hide: () => void;
  markDropped: () => void;
  show: (files: Iterable<{ name: string }>) => void;
}

/** Creates an isolated full-window drop target above the zatto preview frame. */
export function createHtmlFileDropShield(
  ownerDocument: Document,
): HtmlFileDropShield {
  const style = ownerDocument.createElement("style");
  style.textContent = createHtmlFileDropShieldStyles({
    activeAttribute: ACTIVE_ATTRIBUTE,
    countId: COUNT_ID,
    shieldId: SHIELD_ID,
  });
  const shield = ownerDocument.createElement("div");
  shield.id = SHIELD_ID;
  shield.dataset.state = "idle";
  shield.setAttribute("aria-hidden", "true");

  const portal = ownerDocument.createElement("div");
  portal.dataset.part = "portal";
  const icon = ownerDocument.createElement("span");
  icon.dataset.part = "icon";
  icon.setAttribute("aria-hidden", "true");
  const title = ownerDocument.createElement("strong");
  title.textContent = "Drop HTML";
  const count = ownerDocument.createElement("span");
  count.id = COUNT_ID;
  count.textContent = "Drop HTML files anywhere";
  portal.append(icon, title, count);
  shield.append(portal);

  const mount = () => ownerDocument.body?.append(style, shield);
  if (ownerDocument.readyState === "loading") {
    ownerDocument.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }

  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  const cancelScheduledHide = () => {
    if (hideTimer !== undefined) clearTimeout(hideTimer);
    hideTimer = undefined;
  };
  const setState = (state: "active" | "dropped" | "idle") => {
    shield.dataset.state = state;
    shield.setAttribute("aria-hidden", String(state === "idle"));
    if (state === "active") {
      ownerDocument.documentElement.setAttribute(ACTIVE_ATTRIBUTE, "active");
    } else {
      ownerDocument.documentElement.removeAttribute(ACTIVE_ATTRIBUTE);
    }
  };

  return {
    hide: () => {
      cancelScheduledHide();
      setState("idle");
    },
    markDropped: () => {
      cancelScheduledHide();
      setState("dropped");
      hideTimer = setTimeout(() => {
        hideTimer = undefined;
        setState("idle");
      }, 320);
    },
    show: (files) => {
      cancelScheduledHide();
      const names = [...files].map((file) => file.name);
      const htmlCount = names.filter(isHtmlFileName).length;
      shield.dataset.tone =
        names.length > 0 && htmlCount === 0 ? "unsupported" : "ready";
      count.textContent = dropCountMessage(htmlCount, names.length);
      setState("active");
    },
  };
}

function dropCountMessage(htmlCount: number, fileCount: number): string {
  if (fileCount > 0 && htmlCount === 0) return "HTML files only";
  if (htmlCount === 1) return "1 HTML file ready";
  if (htmlCount > 1) return `${htmlCount} HTML files ready`;
  return "Drop HTML files anywhere";
}

function isHtmlFileName(name: string): boolean {
  const lowerName = name.toLowerCase();
  return lowerName.endsWith(".html") || lowerName.endsWith(".htm");
}
