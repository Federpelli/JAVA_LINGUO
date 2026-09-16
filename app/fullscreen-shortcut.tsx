'use client';

import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export default function FullscreenShortcut() {
  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;

    const appWindow = getCurrentWindow();

    async function exitFullscreen(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape' || event.repeat) return;

      try {
        if (await appWindow.isFullscreen()) {
          await appWindow.setFullscreen(false);
        }
      } catch (error) {
        console.error('[window:exit-fullscreen]', error);
      }
    }

    window.addEventListener('keydown', exitFullscreen, { capture: true });
    return () => window.removeEventListener('keydown', exitFullscreen, { capture: true });
  }, []);

  return null;
}
