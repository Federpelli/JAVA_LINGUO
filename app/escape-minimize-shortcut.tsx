'use client';

import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export default function EscapeMinimizeShortcut() {
  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;

    const appWindow = getCurrentWindow();

    async function minimizeWindow(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape' || event.repeat) return;

      event.preventDefault();
      event.stopPropagation();

      try {
        await appWindow.minimize();
      } catch (error) {
        console.error('[window:minimize]', error);
      }
    }

    window.addEventListener('keydown', minimizeWindow, { capture: true });
    return () => window.removeEventListener('keydown', minimizeWindow, { capture: true });
  }, []);

  return null;
}
