export type ReleaseFeature = {
  title: string;
  description: string;
};

export type ReleaseNotes = {
  version: string;
  title: string;
  introduction: string;
  features: ReleaseFeature[];
};

export const CURRENT_RELEASE_NOTES: ReleaseNotes = {
  version: '0.7.0',
  title: 'Scopri cosa c\u2019\u00e8 di nuovo',
  introduction:
    'JAVA_linguo si \u00e8 aggiornato. Ecco le novit\u00e0 principali prima di riprendere il tuo percorso.',
  features: [
    {
      title: 'Riepilogo dopo ogni aggiornamento',
      description:
        'Al primo avvio di una nuova versione trovi una sintesi chiara delle funzionalit\u00e0 appena aggiunte.',
    },
    {
      title: 'Visualizzazione una sola volta',
      description:
        'La versione viene segnata come letta quando chiudi il riepilogo, senza mostrarti lo stesso messaggio agli avvii successivi.',
    },
    {
      title: 'Progressi sempre separati',
      description:
        'Le preferenze del popup restano locali e non modificano lezioni completate, appunti o codice del laboratorio.',
    },
  ],
};

export function shouldShowReleaseNotes(
  currentVersion: string,
  lastSeenVersion?: string,
) {
  return currentVersion.length > 0 && currentVersion !== lastSeenVersion;
}
