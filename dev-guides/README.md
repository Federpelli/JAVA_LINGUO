# Guida di sviluppo

Leggere queste regole prima di modificare l’applicazione.

## Creazione delle lezioni

Prima di aggiungere o modificare una lezione, leggere e applicare integralmente [CREAZIONE_LEZIONI.md](CREAZIONE_LEZIONI.md). La guida definisce il livello accademico, la struttura didattica, gli esercizi e i criteri di valutazione obbligatori.

## Versioni e pubblicazione

Prima di preparare una nuova versione, seguire [RILASCI.md](RILASCI.md). Versione visibile, changelog, tag e release GitHub devono rimanere sincronizzati.

## Sicurezza

Prima di modificare server locale, API del laboratorio, esecuzione Docker, dipendenze o workflow GitHub, leggere e applicare [SICUREZZA.md](SICUREZZA.md). I confini descritti nella guida sono invarianti di progetto e devono essere coperti da test.

## Didattica

- Scrivere spiegazioni in italiano semplice, introducendo un concetto alla volta.
- Ogni termine tecnico deve essere spiegato prima di essere usato.
- Usare esempi diversi dalla soluzione finale del laboratorio.
- Ogni scheda teorica deve contenere: spiegazione, esempio o analogia, passaggi guidati e domanda di comprensione.
- Separare sempre teoria, verifica e laboratorio.
- Non inserire la soluzione completa nello starter code o nelle schede teoriche.
- Distinguere feature Java definitive, preview e incubator.

## Interfaccia

- Conservare il flusso Teoria → Verifica → Laboratorio.
- Conservare lo sblocco sequenziale: la lezione successiva diventa accessibile soltanto dopo il completamento di tutte le precedenti.
- Corpo del testo almeno 16 px e contrasto leggibile.
- Tutti i controlli devono funzionare con tastiera e avere un’etichetta accessibile.
- Progressi e note devono restare locali al dispositivo.
- L’aggiunta di una lezione non deve richiedere di ricreare l’app.

## Quality gate

Prima di considerare completa una modifica:

```powershell
npx oxlint app
npm run test:update-errors
npm run course:validate
npm run build
.venv\Scripts\python.exe -m py_compile avvia.py collega_github.py
```

Verificare inoltre che `avvia.py` serva la pagina con risposta HTTP 200 e che `.env` non sia versionato.
