const TAURI_RUNTIME_MARKER = '__TAURI_INTERNALS__';

export function isTauriRuntime() {
  return typeof window !== 'undefined' && TAURI_RUNTIME_MARKER in window;
}

export async function loadNativeCourseProgress() {
  if (!isTauriRuntime()) return null;

  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string | null>('load_course_progress');
}

export async function saveNativeCourseProgress(payload: string) {
  if (!isTauriRuntime()) return false;

  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('save_course_progress', { payload });
  return true;
}
