const userIdStub = 'f2c9142d-eff1-4039-82e5-ac0f50dd29e1';

const base64URLStringToBuffer = base64URLString => {
  const base64 = base64URLString.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = base64.padEnd(base64.length + padLength, '=');
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return buffer;
};

const bufferToBase64URLString = buffer => {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const charCode of bytes) {
    str += String.fromCharCode(charCode);
  }
  const base64String = btoa(str);
  return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

let currentAbortSignal;

const createAbortSignal = () => {
  if (currentAbortSignal) {
    const error = new Error('Canceling existing WebAuthn API call for a new one.');
    error.name = 'AbortError';
    currentAbortSignal.abort(error);
  }

  currentAbortSignal = new AbortController();

  return currentAbortSignal.signal;
};

/**
 * Validate clientDataJSON.
 * Do not compare it against a template.
 * For more details see https://goo.gl/yabPex/
 */
const validateClientDataJSON = (clientDataJSON, challenge) => {
  const clientData = JSON.parse(atob(bufferToBase64URLString(clientDataJSON)));

  console.log('clientDataJSON:', clientData);

  if (clientData.origin !== location.origin || clientData.challenge !== challenge) {
    throw new Error('Credentials were got with errors.');
  }
};

export const encodeData = data => {
  return btoa(encodeURI(encodeURIComponent(JSON.stringify(data))));
};

export const decodeData = encodedData => {
  return decodeURIComponent(decodeURI(atob(encodedData)));
};

export const passkeySupported = () => {
  return !!(navigator.credentials?.create
    && navigator.credentials?.get
    && window.PublicKeyCredential
  );
};

export const passkeyAutofillSupported = async () => {
  return window.PublicKeyCredential?.isConditionalMediationAvailable
    && window.PublicKeyCredential.isConditionalMediationAvailable();
};

export const startRegistration = async userName => {
  // const registrationOptionsResponse = await fetch('/registration/options', {
  //   method: 'POST',
  //   body: JSON.stringify({ username })
  // });
  // const registrationOptions = await registrationOptionsResponse.json();
  const registrationOptions = {
    attestation: 'none',
    timeout: 60_000,
    pubKeyCredParams: [],
    challenge: 'RKWiYLDyF4W0kwQLilngnAQq-Jh6N-ERYeofbHwSZcg',
    authenticatorSelection: {
      requireResidentKey: true,
      residentKey: 'required',
      userVerification: 'preferred'
    },
    rp: {
      name: location.hostname,
      id: location.hostname
    },
    user: {
      id: userIdStub,
      name: userName,
      displayName: userName,
    }
  };

  // https://developer.mozilla.org/en-US/docs/Web/API/CredentialsContainer/create
  const credential = await navigator.credentials.create({
    publicKey: {
      ...registrationOptions,
      challenge: base64URLStringToBuffer(registrationOptions.challenge),
      user: {
        ...registrationOptions.user,
        id: base64URLStringToBuffer(registrationOptions.user.id),
      }
    },
    signal: createAbortSignal(),
  });

  validateClientDataJSON(credential.response.clientDataJSON, registrationOptions.challenge);

  console.log(credential);
};

export const startAuthentication = async conditionalUI => {
  // const authOptionsResponse = await fetch('/authentication/options', { method: 'POST' });
  // const authOptions = await authOptionsResponse.json();
  const authOptions = {
    timeout: 60_000,
    rpId: location.hostname,
    userVerification: 'preferred',
    challenge: 'Hf-vYl-5GF7Vc1cYcq-gBdICUSstA7eLTirkjiMjt6U',
  };

  const credential = await navigator.credentials.get({
    publicKey: {
      ...authOptions,
      challenge: base64URLStringToBuffer(authOptions.challenge),
    },
    signal: createAbortSignal(),
    mediation: conditionalUI ? 'conditional' : undefined,
  });

  validateClientDataJSON(credential.response.clientDataJSON, authOptions.challenge);

  console.log(credential);

  // const authOptionsResponse = await fetch('/login/finalize', {
  const authOptionsResponse = await fetch('/authentication/verification', {
    method: 'POST',
    body: JSON.stringify({
      id: credential.id,
      rawId: bufferToBase64URLString(credential.rawId),
      type: credential.type,
      authenticatorAttachment: credential.authenticatorAttachment,
      clientExtensionResults: credential.getClientExtensionResults(),
      response: {
        authenticatorData: bufferToBase64URLString(credential.response.authenticatorData),
        clientDataJSON: bufferToBase64URLString(credential.response.clientDataJSON),
        signature: bufferToBase64URLString(credential.response.signature),
        userHandle: bufferToBase64URLString(credential.response.userHandle),
      },
    }),
  });

  // fetch('/login/finalize', { method: 'POST', ... });
  // Response body:
  // {
  //   credential_id: 'roVYMTLMAo8dapJeU0v6p-8X4B3U2DEhvKU8fryqWVQ'
  //   user_id: userIdStub
  // }

  // Response headers:
  // X-Auth-Token: JWT
  // eyJhbGciOiJSUzI1NiIsImtpZCI6IjFiMTY4MTUyLWY1MmYtNGEzNi1hODM3LTRmMjc1Mzg3MzVhMyIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsid3d3LnBhc3NrZXlzLmlvIl0sImV4cCI6MTY5NDE4MDA1NCwiaWF0IjoxNjk0MTc2NDU0LCJzdWIiOiIyODg1ZDcyZS1kYWJiLTRjZDctYjllMC1kMmQzNjEwOTI2N2QifQ.QucQF8AK5-5eJ_pjGdospYoH1JiXPZrB_xPZuWsiXQ51cKCKgcQtmwbc7fJuSXVJpY_CXs9iMcAeBKwDvBl2F7vMq78ULy2ue12Kg3MYgbPfb2DdxxjkiiUCVoEhAhedLOa4GZRN9OiSqXE6k3ydopsKBWdYtT1e0oWfB_aYLW4RLmU6gYtA9TNZwt5tJvwmJaTY7VuxXIBmhw69iaaqM8lpLcJF1RubFokEfYLy36Jv_viw0oRAHD1U1yUQUMiaQDn22XPFTAPf4VjiEfcr9IpUqG3v9PsLdBmiCXGaEDaYA8IW5WEf8waPIDEEgoDUyM4NC2y4GMaP1sni7KTWLDAWcURiYnW4_2rKaY8sh1kbWR5kRO8B6QkJI-ZOHnO0nL1AvH8fiHYQoc8IDCUITP03af81FWM2D70icXL-qXm7vlGlMGowDx0xtHoozKN00gCqCHqIiNQDGAD5HLKl4x4BRVFlRyzjqJ0zvdRaWlovQyrXiFS9zhP5qUogt6u4UeeFqnI2NzdqWn4OWbJs_AqNDevL0bPJ0MNYaO9H5ZnPPJX-TNlhDoJY9iUl2iWUr2ozi-twkeVklMxjude5UhpMWdjIKfXcqDMiQxsx9GvkQP7Nfn_SFRRBBdu0e8vcIPiilHNSPScKpRSjqQQlaHPrG6QOXfr5N7EzJkf_08A
  // X-Session-Lifetime: 3600

  // const encodedSessionData = encodeData({
  //   session: {
  //     expiry: 1694162809, // new Date(session.expiry * 1000)
  //     userID: userIdStub,
  //     authFlowCompleted: true
  //   }
  // });
  // localStorage.setItem('user_session', encodedSessionData);
};

const processLoginResponseHeaders = headers => {
  const authToken = headers.get('x-auth-token');
  if (authToken) {
    // The token can be used later to set the Authorization header for HTTP requests.
    document.cookie = `auth_token=${authToken}`;
  }

  const sessionLifetimeSeconds = headers.get('x-session-lifetime');
  if (sessionLifetimeSeconds) {
    const expirationTime = Date.now() + (parseInt(sessionLifetimeSeconds, 10) * 1_000);
    console.log('Session expire time:', new Date(expirationTime));

    /**
     * Schedule session expiration event.
     * When it occurs, the user may be automatically logged out,
     * or a re-login dialog may be displayed.
     */
    // scheduleSessionExpirationEvent(expirationSeconds);
  }
};

fetch('https://jsonplaceholder.typicode.com/todos')
  .then(response => {
    processLoginResponseHeaders(response.headers);
    return response.json();
  })
;
