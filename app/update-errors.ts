export type UpdateFailureStage = 'check' | 'download' | 'install' | 'relaunch' | 'fallback';

export const RELEASES_URL = 'https://github.com/Federpelli/JAVA_LINGUO/releases/latest';

export function errorDetail(error: unknown): string {
  let detail: string;
  if (error instanceof Error) {
    detail = error.message;
  } else if (typeof error === 'string') {
    detail = error;
  } else {
    try {
      detail = JSON.stringify(error);
    } catch {
      detail = String(error);
    }
  }

  return detail.replace(/\s+/g, ' ').trim().slice(0, 500) || 'Errore sconosciuto';
}

export function updateErrorMessage(stage: UpdateFailureStage, detail: string): string {
  const normalized = detail.toLowerCase();

  if (/not allowed by acl|acl.*(?:denied|forbidden)|command .*not allowed/.test(normalized)) {
    return 'Questa versione non è autorizzata a usare il servizio aggiornamenti. Installa manualmente la release più recente per ripristinare gli aggiornamenti automatici.';
  }
  if (/signature|public key|checksum|integrity/.test(normalized)) {
    return 'Il pacchetto è stato rifiutato perché non è stato possibile verificarne l’integrità. La versione installata non è stata modificata.';
  }
  if (/json|manifest|parse|deserialize|invalid release/.test(normalized)) {
    return 'Il servizio ha risposto, ma i dati della release non sono validi. Puoi usare il download manuale mentre il manifest viene corretto.';
  }
  if (/timed?\s*out|timeout|deadline/.test(normalized)) {
    return 'Il servizio aggiornamenti non ha risposto entro 30 secondi. Controlla la connessione e riprova oppure usa il download manuale.';
  }
  if (/\b404\b|not found/.test(normalized)) {
    return 'Il file richiesto non è disponibile nella release più recente. Usa la pagina di download per scegliere manualmente l’installer.';
  }
  if (/\b401\b|\b403\b|\b429\b|rate.?limit|forbidden|unauthorized/.test(normalized)) {
    return 'GitHub ha rifiutato temporaneamente la richiesta. Attendi qualche minuto oppure usa la pagina di download.';
  }
  if (/certificate|certificat|tls|ssl/.test(normalized)) {
    return 'La connessione sicura a GitHub non è stata verificata. Controlla data e ora, antivirus, proxy o certificati di rete.';
  }
  if (/dns|name resolution|resolve host|getaddrinfo/.test(normalized)) {
    return 'Il nome del servizio GitHub non è stato risolto. Controlla DNS, VPN e connessione Internet.';
  }
  if (/proxy/.test(normalized)) {
    return 'Il proxy di rete ha impedito il controllo. Verifica la configurazione del proxy oppure usa il download manuale.';
  }
  if (/no space|disk full|not enough space/.test(normalized)) {
    return 'Lo spazio disponibile non è sufficiente per completare l’aggiornamento. Libera spazio e riprova.';
  }
  if (/permission|access denied|operation not permitted|os error 5/.test(normalized)) {
    return 'Windows non consente di modificare i file dell’app. Chiudi le altre istanze e riprova, oppure installa manualmente la release.';
  }
  if (/move|replace|in use|being used|locked/.test(normalized)) {
    return 'I file dell’app risultano ancora in uso e non possono essere sostituiti. Chiudi JAVA_linguo e usa l’installer manuale.';
  }
  if (/network|connect|connection|send request|socket/.test(normalized)) {
    return 'JAVA_linguo non riesce a raggiungere GitHub. Controlla firewall, antivirus, VPN o proxy e riprova.';
  }

  if (stage === 'download') {
    return 'Il download non è stato completato. La versione attuale è intatta: puoi riprovare o usare il download manuale.';
  }
  if (stage === 'install') {
    return 'Il pacchetto è stato scaricato, ma l’installazione non è riuscita. Chiudi l’app e usa l’installer manuale.';
  }
  if (stage === 'relaunch') {
    return 'L’aggiornamento è stato installato, ma il riavvio automatico non è riuscito. Chiudi e riapri JAVA_linguo.';
  }
  if (stage === 'fallback') {
    return 'Non riesco ad aprire il browser predefinito. Copia l’indirizzo mostrato qui sotto e aprilo manualmente.';
  }
  return 'Il controllo degli aggiornamenti non è riuscito. Puoi riprovare oppure usare il download manuale.';
}
