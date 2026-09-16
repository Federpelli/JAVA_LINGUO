# Changelog

Tutte le modifiche rilevanti di JAVA_linguo sono documentate in questo file. Il progetto segue il versionamento semantico.

## [0.6.6] - 2026-09-16

### Corretto

- il tasto `Esc` ora riduce a icona la finestra desktop, anche quando è in modalità fullscreen;
- navigazione tra le schede resa atomica e resistente ai clic rapidi, con ritorno visibile all’inizio del nuovo capitolo;
- schermata di recupero al posto di un’interfaccia bloccata quando React intercetta un errore di rendering.

### Modificato

- repository, download manuale e unico endpoint updater migrati a `Federpelli/JAVA_LINGUO`;
- richieste al servizio locale limitate nel tempo e salvataggio dei progressi differito, per evitare attese indefinite o rallentamenti durante la scrittura.

## [0.6.5] - 2026-09-16

### Modificato

- la finestra principale si apre direttamente in modalità fullscreen.

## [0.6.4] - 2026-09-16

### Corretto

- autorizzazione ACL dell’updater per il frontend incorporato servito dal sidecar su una porta dinamica di `127.0.0.1`;
- capability remota separata e minimale, senza accesso alla shell, limitata a controllo, installazione firmata, riavvio e apertura del fallback ufficiale;
- messaggio specifico quando un comando dell’updater viene bloccato dall’ACL.

## [0.6.3] - 2026-09-15

### Corretto

- errori dell’updater distinti per controllo, download, integrità, installazione e riavvio, con dettaglio tecnico locale e indicazioni specifiche;
- fallback alla pagina ufficiale delle release quando l’aggiornamento automatico non è disponibile, limitando il permesso di apertura esterna al solo URL previsto.

## [0.6.2] - 2026-09-11

### Corretto

- avvio Windows senza finestre terminale temporanee durante i controlli e i comandi Docker;
- verifica di Docker spostata all’apertura del Laboratorio, così Teoria e Verifica non attendono processi esterni all’avvio;
- nuovo controllo dello stato della sandbox protetto da origine locale, cookie di sessione e limiti di concorrenza.

## [0.6.1] - 2026-09-11

### Corretto

- terminazione del backend incorporato prima che l’installer Windows sostituisca i file, evitando il blocco di `java-linguo-backend.exe`;
- chiusura preventiva dei backend rimasti orfani durante installazione, aggiornamento e disinstallazione NSIS;
- generazione degli archivi `.app.tar.gz` necessari agli aggiornamenti automatici su macOS Intel e Apple Silicon.

## [0.6.0] - 2026-09-10

### Aggiunto

- corso Java completo di 52 lezioni: 48 lezioni progressive e 4 capstone, dai fondamenti fino a Java 25, JVM, concorrenza e architettura;
- teoria in sei sezioni, almeno cinque domande di verifica, laboratorio guidato, casi limite, rubriche e fonti ufficiali per ogni nuova lezione;
- percorso guidato con sblocco sequenziale delle lezioni e salvataggio separato di avanzamento, risposte, appunti e codice;
- controllo automatico degli aggiornamenti tramite plugin ufficiale Tauri, con dialogo di conferma, avanzamento download, installazione e riavvio;
- pacchetti updater firmati e manifest `latest.json` generati dalla pipeline desktop per Windows, macOS e Linux;
- validatore del catalogo che controlla completezza e compila tutti i 52 file iniziali `Main.java`.

### Migliorato

- catalogo caricato in gruppi dinamici per mantenere leggera la schermata iniziale anche con l'intero corso;
- navigazione mobile con selettore delle lezioni e metadati didattici con prerequisiti, obiettivo e fonti;
- procedura di release resa idempotente e serializzata per evitare conflitti durante la generazione del manifest multi-piattaforma.

### Sicurezza

- verifica crittografica Tauri obbligatoria prima dell'installazione di ogni aggiornamento;
- chiave privata esclusa dal repository e procedura dedicata per salvarla nei GitHub Actions Secrets.

## [0.5.0] - 2026-09-09

### Aggiunto

- editor CodeMirror 6 con parser Java, tema ispirato a Visual Studio Code, numeri di riga ed evidenziazione sintattica durante la scrittura;
- icona coordinata nell'interfaccia, nella schermata di avvio e nei metadati web, oltre ai formati nativi già inclusi negli installer;
- etichetta visibile, esempio e stato di focus per il campo di scrittura del terminale.

### Migliorato

- guida d'installazione riorganizzata per sistema operativo, con scelta del file, primi passi e risoluzione dei problemi più comuni;
- leggibilità e accessibilità dell'area di lavoro del laboratorio.

### Corretto

- reso affidabile il comando di build su Windows gestendo esclusivamente l'asserzione `libuv` emessa da Node dopo una compilazione già completata e verificata.

## [0.4.2] - 2026-09-09

### Corretto

- resa deterministica la creazione degli installer desktop usando il frontend `dist` già versionato e verificato dalla pipeline di qualità;
- rimossa la ricompilazione ridondante del frontend su ciascun sistema operativo durante la pubblicazione.

## [0.4.1] - 2026-09-09

### Corretto

- separata la generazione del frontend e del sidecar per usare la shell nativa di ogni runner GitHub;
- inoltrata correttamente a Cargo l'opzione `--locked` durante le build Tauri;
- letta la versione degli installer direttamente dal file `VERSION`, evitando sintassi dipendente dalla shell.

## [0.4.0] - 2026-09-09

### Aggiunto

- applicazione desktop nativa basata su Tauri per Windows, macOS Apple Silicon, macOS Intel e Linux;
- backend Python incorporato come sidecar: l'utente finale non deve installare Python o Node.js;
- installer e checksum SHA-256 creati automaticamente su ogni sistema operativo e pubblicati nelle release GitHub;
- schermata di avvio, icona coordinata e controllo automatico di disponibilità del server locale.

### Migliorato

- nome del prodotto uniformato a `JAVA_linguo` nell'interfaccia, nei pacchetti e nella documentazione;
- migrazione trasparente dei progressi salvati con il precedente nome dell'app;
- dipendenze Cloudflare e Sharp aggiornate per mantenere l'audit privo di vulnerabilità note.

### Sicurezza

- permessi Tauri ridotti all'avvio del solo sidecar dichiarato con argomenti validati;
- server e sandbox Docker invariati nei loro confini: loopback, cookie HttpOnly, allowlist dei comandi e limiti di risorse;
- build native separate per piattaforma con attestazione di provenienza GitHub.

## [0.3.1] - 2026-09-08

### Corretto

- reso il lockfile npm portabile anche sui runner Linux includendo esplicitamente le dipendenze WebAssembly necessarie alla build;
- disattivati gli script di installazione npm nelle pipeline CI e di release per ridurre la superficie di attacco della supply chain.

## [0.3.0] - 2026-09-08

### Sicurezza

- sessione del laboratorio spostata in un cookie `HttpOnly` e `SameSite=Strict`;
- richieste locali protette con controlli `Host` e `Origin`, rate limit e singola esecuzione concorrente;
- sandbox eseguita come utente non-root con filesystem read-only, capability azzerate e nuovi limiti su swap, file e spazio temporaneo;
- file Java montato singolarmente in sola lettura e output acquisito con limite prima di raggiungere la memoria del processo Python;
- immagine Eclipse Temurin 25 fissata tramite digest verificabile;
- Content Security Policy e ulteriori header di sicurezza applicati a tutte le risposte;
- dipendenze vulnerabili aggiornate e audit npm portato a zero segnalazioni;
- aggiunti CI, CodeQL, Dependency Review, Dependabot e politica privata di segnalazione.

## [0.2.2] - 2026-09-08

### Migliorato

- consegne delle tre missioni di laboratorio ampliate con scenario, contratto e procedura guidata;
- casi normali, limite e non validi presentati insieme al motivo per cui devono essere provati;
- criteri di completamento, riflessione progettuale e sfida facoltativa resi espliciti;
- flusso del laboratorio riordinato per leggere la consegna prima di usare editor e terminale.

## [0.2.1] - 2026-09-08

### Migliorato

- finestra di conferma per l'azzeramento coerente con lo stile dell'app e accessibile da tastiera;
- barre di scorrimento verticali nascoste mantenendo rotellina, touchpad e navigazione da tastiera.

## [0.2.0] - 2026-09-08

### Aggiunto

- editor Java e terminale interattivo nel laboratorio;
- esecuzione tramite container Docker temporaneo senza accesso alla rete;
- limiti di CPU, memoria, processi e tempo di esecuzione;
- versione visibile nell'app e procedura di rilascio su GitHub;
- guida pubblica di installazione e aggiornamento.

### Migliorato

- navigazione Teoria, Verifica e Laboratorio integrata nell'header;
- presentazione del prodotto, stato della sandbox e utilizzo su dispositivi mobili;
- messaggio sulla pubblicazione di nuovo materiale ogni due settimane.

## [0.1.0] - 2026-09-07

### Aggiunto

- prima lezione su stringhe, cicli e casi limite;
- percorso Teoria → Verifica → Laboratorio;
- salvataggio locale di progressi e appunti;
- avvio locale tramite Python.
