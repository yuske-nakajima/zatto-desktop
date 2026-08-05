import "./styles.css";

const preparationScreen = document.querySelector<HTMLElement>(
  '[data-screen="preparation"]',
);
const errorScreen = document.querySelector<HTMLElement>(
  '[data-screen="error"]',
);

function showErrorScreen(): void {
  if (preparationScreen !== null) preparationScreen.hidden = true;
  if (errorScreen !== null) errorScreen.hidden = false;
}

const requestedState = new URL(window.location.href).searchParams.get("state");
if (requestedState === "error") showErrorScreen();

window.addEventListener("error", () => {
  console.error("Zatto Desktop could not display its application screen.");
  showErrorScreen();
});

window.addEventListener("unhandledrejection", () => {
  console.error("Zatto Desktop could not display its application screen.");
  showErrorScreen();
});
