# Guida di sicurezza

Queste regole sono obbligatorie per ogni modifica al server locale, alla sandbox Docker, alle dipendenze o alle automazioni GitHub.

## Modello di minaccia

JAVA_linguo deve limitare sei categorie di rischio:

1. codice Java errato o deliberatamente ostile;
2. pagine web esterne che tentano di contattare il server locale;
3. esaurimento di CPU, memoria, processi, disco oppure output;
4. accesso accidentale a file, rete o segreti del computer;
5. dipendenze o artefatti di release compromessi.
6. abuso dei permessi della shell desktop o sostituzione del sidecar incorporato.

La sandbox è destinata all'uso locale da parte di una persona. Non presentarla come isolamento sufficiente per un servizio pubblico multiutente.

## Invarianti del server locale

- Ascoltare esclusivamente su `127.0.0.1`, mai su `0.0.0.0`.
- Accettare soltanto gli host `127.0.0.1` e `localhost` con la porta effettiva del server.
- Richiedere un `Origin` locale esatto per le operazioni che eseguono codice.
- Conservare il segreto di sessione in un cookie `HttpOnly` e `SameSite=Strict`; non inserirlo in JSON, HTML, log o localStorage.
- Accettare soltanto `POST application/json` con `Content-Length` entro il limite e senza transfer encoding alternativo.
- Applicare rate limit, timeout della connessione e un numero massimo di sandbox concorrenti.
- Inviare gli header di sicurezza anche nelle risposte di errore.

## Invarianti della sandbox Docker

- Passare gli argomenti a Docker come lista e non usare mai una shell.
- Mantenere una allowlist esatta dei comandi visibili all'utente.
- Non usare `--privileged`, non montare il socket Docker e non disabilitare seccomp.
- Usare rete `none`, filesystem di base read-only, `--cap-drop ALL`, `no-new-privileges` e un UID/GID non-root.
- Montare soltanto il singolo file `Main.java` in sola lettura; repository, Desktop e cartella personale non devono entrare nel container.
- Usare tmpfs con quota per file temporanei e output di compilazione.
- Limitare memoria, swap, CPU, processi e file aperti.
- Interrompere il container al timeout o al superamento del limite di output; il buffer Python deve restare limitato durante la lettura, non soltanto dopo.
- Usare per impostazione predefinita un'immagine JDK fissata tramite digest.

## Dipendenze e GitHub

- Mantenere versioni esatte e lockfile aggiornato.
- In CI e nelle release usare `npm ci --ignore-scripts`; abilitare script di installazione soltanto dopo una revisione esplicita della dipendenza che li richiede.
- Non usare `npm audit fix --force` senza analisi della compatibilità.
- Le GitHub Actions devono essere fissate a commit completi e aggiornate da Dependabot.
- CI, CodeQL e Dependency Review devono restare attivi.
- Ogni release deve produrre SBOM, checksum e attestazione di provenienza.
- Token e credenziali non devono mai essere salvati nel repository o negli artefatti.

## Invarianti dell'app desktop

- Il nome pubblico del prodotto deve essere `JAVA_linguo`; gli identificatori tecnici possono usare `java-linguo`.
- Il WebView deve raggiungere soltanto il server HTTP locale creato dal sidecar.
- Le API Tauri usate dal frontend HTTP devono essere concesse da una capability remota separata, limitata a `http://127.0.0.1:*`, alla finestra `main` e ai soli comandi necessari; non concedere al frontend remoto i permessi della shell.
- Il plugin shell deve poter avviare esclusivamente `java-linguo-backend` con gli argomenti documentati e validati.
- Il processo sidecar deve terminare alla chiusura dell'app.
- Il backend incorporato deve contenere la build frontend e `VERSION`, senza `.env`, segreti o file di sviluppo.
- Ogni piattaforma deve compilare il proprio installer; non usare cross-compilazione per gli artefatti pubblici.
- `Cargo.lock`, `package-lock.json` e `requirements-desktop.txt` devono essere versionati e usati in modalità bloccata nelle pipeline.
- Non dichiarare firma o notarizzazione finché i certificati non sono realmente configurati.

## Test minimi

Oltre ai quality gate generali, verificare almeno:

- host e origine non consentiti;
- cookie assente o errato;
- comando fuori allowlist;
- richiesta e codice oltre il limite;
- secondo comando mentre la sandbox è occupata;
- loop infinito e output eccessivo;
- tentativo di rete e accesso a file esterni;
- presenza di utente non-root, mount read-only e limiti nel comando Docker;
- audit npm senza vulnerabilità alte o critiche.
