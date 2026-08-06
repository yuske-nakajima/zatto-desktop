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
  overflow: hidden;
  color: #fff;
  background:
    radial-gradient(circle at 50% 45%, rgb(99 102 241 / 46%), transparent 36%),
    linear-gradient(135deg, rgb(15 23 42 / 88%), rgb(49 46 129 / 82%));
  backdrop-filter: blur(14px) saturate(1.35);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 180ms ease, visibility 180ms ease;
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
#${shieldId}::before,
#${shieldId}::after {
  content: "";
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
#${shieldId}::before {
  width: min(74vw, 760px);
  aspect-ratio: 1;
  padding: 4px;
  background: conic-gradient(from 0deg, transparent, #818cf8, #22d3ee, #c084fc, transparent 72%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  animation: zatto-desktop-drop-orbit 2.4s linear infinite;
}
#${shieldId}::after {
  width: min(52vw, 520px);
  aspect-ratio: 1;
  border: 1px solid rgb(255 255 255 / 34%);
  box-shadow: 0 0 80px rgb(99 102 241 / 64%), inset 0 0 70px rgb(34 211 238 / 16%);
  animation: zatto-desktop-drop-pulse 1.5s ease-in-out infinite;
}
#${shieldId} [data-part="portal"] {
  position: relative;
  z-index: 1;
  display: grid;
  justify-items: center;
  gap: 12px;
  min-width: min(76vw, 420px);
  padding: 42px 48px;
  border: 1px solid rgb(255 255 255 / 28%);
  border-radius: 28px;
  background: rgb(15 23 42 / 58%);
  box-shadow: 0 24px 90px rgb(0 0 0 / 38%);
  transform: scale(.78) translateY(28px);
  transition: transform 360ms cubic-bezier(.16, 1, .3, 1);
}
#${shieldId}[data-state="active"] [data-part="portal"] {
  transform: scale(1) translateY(0);
}
#${shieldId}[data-state="dropped"] [data-part="portal"] {
  transform: scale(1.22);
}
#${shieldId}[data-tone="unsupported"] [data-part="portal"] {
  border-color: rgb(248 113 113 / 72%);
}
#${shieldId} [data-part="icon"] {
  width: 62px;
  height: 76px;
  border: 3px solid currentColor;
  border-radius: 10px;
  background: linear-gradient(145deg, rgb(255 255 255 / 22%), transparent);
  box-shadow: 0 0 36px rgb(165 180 252 / 72%);
  animation: zatto-desktop-drop-float 1.8s ease-in-out infinite;
}
#${shieldId} [data-part="icon"]::after {
  content: "↓";
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  font: 700 34px/1 system-ui, sans-serif;
}
#${shieldId} strong {
  font: 800 clamp(28px, 5vw, 56px)/1 system-ui, sans-serif;
  letter-spacing: .12em;
  text-shadow: 0 0 30px rgb(165 180 252 / 76%);
}
#${shieldId} #${countId} {
  color: rgb(224 231 255 / 92%);
  font: 650 15px/1.4 system-ui, sans-serif;
  letter-spacing: .04em;
}
html body > *:not(#${shieldId}) {
  transition: transform 240ms ease, filter 240ms ease;
}
html[${activeAttribute}="active"] body > *:not(#${shieldId}) {
  transform: scale(.975);
  filter: saturate(.72);
}
@keyframes zatto-desktop-drop-orbit { to { transform: rotate(1turn); } }
@keyframes zatto-desktop-drop-pulse { 50% { transform: scale(1.08); opacity: .72; } }
@keyframes zatto-desktop-drop-float { 50% { transform: translateY(-9px) rotate(2deg); } }
@media (prefers-reduced-motion: reduce) {
  #${shieldId},
  #${shieldId}::before,
  #${shieldId}::after,
  #${shieldId} [data-part="portal"],
  #${shieldId} [data-part="icon"],
  html[${activeAttribute}="active"] body > *:not(#${shieldId}) {
    animation: none;
    transition-duration: 1ms;
  }
}
`;
}
