interface HtmlFileDropShieldStyleSelectors {
  activeAttribute: string;
  countId: string;
  shieldId: string;
}

/** Builds namespaced CSS for the full-window HTML-file drop shield. */
export function createHtmlFileDropShieldStyles(
  selectors: HtmlFileDropShieldStyleSelectors,
): string {
  const { activeAttribute, countId, shieldId } = selectors;
  return `
#${shieldId} {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: grid;
  place-items: center;
  color: #fff;
  background: rgb(15 23 42 / 82%);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 140ms ease, visibility 140ms ease;
}
#${shieldId}[data-state="active"] {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}
#${shieldId}[data-state="dropped"] {
  opacity: 0;
  visibility: visible;
  pointer-events: none;
  transition-duration: 320ms;
}
#${shieldId} [data-part="portal"] {
  display: grid;
  justify-items: center;
  gap: 10px;
  width: min(calc(100vw - 48px), 360px);
  padding: 36px 24px;
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 8px;
  transform: scale(.98);
  transition: transform 140ms ease;
}
#${shieldId}[data-state="active"] [data-part="portal"] {
  transform: scale(1);
}
#${shieldId}[data-state="dropped"] [data-part="portal"] {
  transform: scale(.98);
}
#${shieldId}[data-tone="unsupported"] [data-part="portal"] {
  border-color: rgb(248 113 113);
}
#${shieldId}[data-tone="unsupported"] #${countId} {
  color: rgb(254 202 202);
}
#${shieldId} [data-part="icon"] {
  width: 34px;
  height: 40px;
  margin-bottom: 6px;
  border: 1.5px solid currentColor;
  border-radius: 4px;
}
#${shieldId} [data-part="icon"]::after {
  content: "↓";
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  font: 500 20px/1 system-ui, sans-serif;
}
#${shieldId} strong {
  font: 650 clamp(21px, 3vw, 28px)/1.2 system-ui, sans-serif;
  letter-spacing: .04em;
}
#${shieldId} #${countId} {
  color: rgb(203 213 225);
  font: 500 14px/1.4 system-ui, sans-serif;
}
html body > *:not(#${shieldId}) {
  transition: transform 140ms ease;
}
html[${activeAttribute}="active"] body > *:not(#${shieldId}) {
  transform: scale(.99);
}
@media (prefers-reduced-motion: reduce) {
  #${shieldId},
  #${shieldId} [data-part="portal"],
  html[${activeAttribute}="active"] body > *:not(#${shieldId}) {
    transition-duration: 1ms;
  }
}
`;
}
