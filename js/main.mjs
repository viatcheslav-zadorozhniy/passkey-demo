/**
 * Implementations:
 * SimpleWebAuthn:
 * demo - https://webauthn.io/
 * documentation - https://simplewebauthn.dev/docs/packages/browser/
 *
 * Hanko:
 * demo - https://passkeys.io/
 * documentation - https://docs.hanko.io/guides/frontend/
 */

import { passkeyAutofillSupported, startAuthentication, startRegistration } from './utils.mjs';

document.getElementById('sign-up-form').addEventListener('submit', async event => {
  event.preventDefault();

  try {
    const formData = new FormData(event.target);
    await startRegistration(formData.get('email'));
  } catch (error) {
    console.error(error);
  }
});

document.getElementById('sign-in-form').addEventListener('submit', async event => {
  event.preventDefault();

  try {
    await startAuthentication(false);
  } catch (error) {
    console.error(error);
  }
});

passkeyAutofillSupported().then(async supported => {
  if (!supported) {
    return;
  }

  try {
    await startAuthentication(true);
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Conditional UI request was aborted');
    } else {
      console.error('Conditional UI error:', error);
    }
  }
});
