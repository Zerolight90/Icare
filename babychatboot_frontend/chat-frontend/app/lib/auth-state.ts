'use client';

import { useSyncExternalStore } from 'react';

const authChanged = 'icare-auth-changed';
function subscribe(notify: () => void) {
  window.addEventListener('storage', notify);
  window.addEventListener(authChanged, notify);
  return () => {
    window.removeEventListener('storage', notify);
    window.removeEventListener(authChanged, notify);
  };
}

export function clearAccessToken() {
  localStorage.removeItem('accessToken');
  window.dispatchEvent(new Event(authChanged));
}

// The server and the first hydration pass must render the same signed-out view.
// This controls presentation only; the server still verifies every protected request.
export function useHasAccessToken() {
  return useSyncExternalStore(subscribe,
    () => Boolean(localStorage.getItem('accessToken')), () => false);
}
