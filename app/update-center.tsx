'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, ExternalLink, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import type { DownloadEvent, Update } from '@tauri-apps/plugin-updater';
import { Button } from '@/components/ui/button';
import { errorDetail, RELEASES_URL, updateErrorMessage, type UpdateFailureStage } from './update-errors';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type UpdateMode = 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'current' | 'error';
export default function UpdateCenter({ currentVersion }: { currentVersion: string }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [mode, setMode] = useState<UpdateMode>('idle');
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [availableVersion, setAvailableVersion] = useState('');
  const [downloaded, setDownloaded] = useState(0);
  const [total, setTotal] = useState<number | undefined>();
  const [failureStage, setFailureStage] = useState<UpdateFailureStage | null>(null);
  const [technicalDetail, setTechnicalDetail] = useState('');
  const updateRef = useRef<Update | null>(null);

  const showFailure = useCallback((stage: UpdateFailureStage, error: unknown, shouldOpen = true) => {
    const detail = errorDetail(error);
    console.error(`[updater:${stage}]`, detail);
    setFailureStage(stage);
    setTechnicalDetail(detail);
    setMessage(updateErrorMessage(stage, detail));
    setMode('error');
    if (shouldOpen) setOpen(true);
  }, []);

  const checkForUpdate = useCallback(async (interactive: boolean) => {
    setMode('checking');
    setFailureStage(null);
    setTechnicalDetail('');
    updateRef.current = null;
    if (interactive) setOpen(true);
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check({ timeout: 30_000 });
      updateRef.current = update;
      if (update) {
        setAvailableVersion(update.version);
        setMode('available');
        setMessage(update.body?.trim() || 'Nuove lezioni e miglioramenti sono pronti per essere installati.');
        setOpen(true);
      } else {
        setMode('current');
        setMessage(`JAVA_linguo ${currentVersion} è già aggiornato.`);
      }
    } catch (error) {
      showFailure('check', error, interactive);
    }
  }, [currentVersion, showFailure]);

  useEffect(() => {
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    queueMicrotask(() => setSupported(isTauri));
    if (!isTauri) return;
    const timeout = window.setTimeout(() => void checkForUpdate(false), 2_500);
    return () => window.clearTimeout(timeout);
  }, [checkForUpdate]);

  async function installUpdate() {
    const update = updateRef.current;
    if (!update) return;
    let stage: UpdateFailureStage = 'download';
    setMode('downloading');
    setDownloaded(0);
    setTotal(undefined);
    setFailureStage(null);
    setTechnicalDetail('');
    try {
      await update.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === 'Started') {
          setTotal(event.data.contentLength);
        } else if (event.event === 'Progress') {
          setDownloaded((value) => value + event.data.chunkLength);
        } else {
          stage = 'install';
          setMode('installing');
        }
      });
      setMode('installing');
      stage = 'relaunch';
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (error) {
      showFailure(stage, error);
    }
  }

  async function openFallback() {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(RELEASES_URL);
    } catch (error) {
      showFailure('fallback', `${errorDetail(error)} — ${RELEASES_URL}`);
    }
  }

  if (supported !== true) return null;

  const busy = mode === 'checking' || mode === 'downloading' || mode === 'installing';
  const percentage = total ? Math.min(100, Math.round((downloaded / total) * 100)) : undefined;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={mode === 'available' ? 'update-button available' : 'update-button'}
        aria-label="Controlla aggiornamenti"
        title={mode === 'available' ? 'Aggiornamento disponibile' : 'Controlla aggiornamenti'}
        disabled={busy}
        onClick={() => mode === 'available' ? setOpen(true) : void checkForUpdate(true)}
      >
        {busy ? <LoaderCircle className="spin" /> : mode === 'available' ? <Download /> : <RefreshCw />}
      </Button>

      <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
        <DialogContent className="update-dialog" showCloseButton={!busy}>
          <DialogHeader>
            <div className="update-dialog-icon" aria-hidden="true">
              {mode === 'current' ? <CheckCircle2 /> : <ShieldCheck />}
            </div>
            <div>
              <DialogTitle>
                {mode === 'checking' && 'Ricerca aggiornamenti…'}
                {mode === 'available' && `JAVA_linguo ${availableVersion} è disponibile`}
                {mode === 'downloading' && 'Download dell’aggiornamento'}
                {mode === 'installing' && 'Installazione in corso'}
                {mode === 'current' && 'Applicazione aggiornata'}
                {mode === 'error' && 'Aggiornamento non riuscito'}
              </DialogTitle>
              <DialogDescription>
                {mode === 'available'
                  ? `Versione installata: ${currentVersion}. Il pacchetto è firmato e verrà verificato prima dell’installazione.`
                  : message || 'Attendi qualche secondo.'}
              </DialogDescription>
            </div>
          </DialogHeader>

          {mode === 'available' && <div className="update-notes"><span>Novità della release</span><p>{message}</p></div>}
          {mode === 'error' && (
            <div className="update-error-details">
              <span>Dettaglio tecnico</span>
              <p>{technicalDetail}</p>
              <small>Download manuale: <code>{RELEASES_URL}</code></small>
            </div>
          )}
          {(mode === 'downloading' || mode === 'installing') && (
            <div className="update-progress">
              <div><span>{mode === 'downloading' ? 'Download verificato' : 'Installazione e riavvio'}</span><strong>{percentage === undefined ? '…' : `${percentage}%`}</strong></div>
              <progress value={percentage} max="100" />
              <small>Non chiudere JAVA_linguo. Al termine l’app verrà riavviata automaticamente.</small>
            </div>
          )}

          <DialogFooter>
            {mode === 'available' && <Button onClick={() => void installUpdate()}><Download /> Scarica e installa</Button>}
            {(mode === 'current' || mode === 'error') && <Button variant="outline" onClick={() => setOpen(false)}>Chiudi</Button>}
            {mode === 'error' && <Button variant="outline" onClick={() => void openFallback()}><ExternalLink /> Pagina download</Button>}
            {mode === 'error' && failureStage !== 'fallback' && <Button onClick={() => void checkForUpdate(true)}><RefreshCw /> Riprova</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
