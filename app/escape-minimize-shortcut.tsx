'use client';

import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export default function EscapeMinimizeShortcut() {
  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;

    const appWindow = getCurrentWindow();
    let handlingEscape = false;

    async function minimizeWindow(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape' || event.repeat || handlingEscape) return;

      event.preventDefault();
      event.stopPropagation();
      handlingEscape = true;

      try {
        await invoke('minimize_main_window');
      } catch (nativeError) {
        try {
          await appWindow.minimize();
        } catch (fallbackError) {
          console.error('[window:minimize]', { nativeError, fallbackError });
        }
      } finally {
        window.setTimeout(() => {
          handlingEscape = false;
        }, 250);
      }
    }

    window.addEventListener('keydown', minimizeWindow, { capture: true });
    window.addEventListener('keyup', minimizeWindow, { capture: true });
    return () => {
      window.removeEventListener('keydown', minimizeWindow, { capture: true });
      window.removeEventListener('keyup', minimizeWindow, { capture: true });
    };
  }, []);

  return null;
}
