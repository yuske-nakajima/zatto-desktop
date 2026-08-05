import './styles.css';

const errorMessage = document.querySelector<HTMLElement>(
  '[data-error-message]',
);

function revealErrorMessage(): void {
  if (errorMessage !== null) {
    errorMessage.hidden = false;
  }
}

window.addEventListener('error', (event) => {
  console.error('Zatto Desktop renderer failed:', event.message);
  revealErrorMessage();
});

window.addEventListener('unhandledrejection', () => {
  console.error('Zatto Desktop renderer failed with an unhandled rejection.');
  revealErrorMessage();
});
