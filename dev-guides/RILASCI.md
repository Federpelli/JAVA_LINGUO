# Procedura di rilascio

JAVA_linguo usa il versionamento semantico `MAJOR.MINOR.PATCH`.

- incrementare `MAJOR` per modifiche incompatibili;
- incrementare `MINOR` per nuove lezioni o funzionalità;
- incrementare `PATCH` per correzioni compatibili.

## File da sincronizzare

Ogni rilascio deve riportare lo stesso numero in:

- `VERSION`;
- `app/version.ts`;
- `package.json` e `package-lock.json`;
- `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` e `src-tauri/tauri.conf.json`;
- badge del `README.md`;
- collegamenti di download diretto del `README.md`, inclusi tag e nomi degli installer;
- nuova sezione di `CHANGELOG.md`.

## Verifiche

Eseguire nell'ordine:

```powershell
npx oxlint app
npm run test:frontend
npm run course:validate
npm run build
npm audit --audit-level=high
.venv\Scripts\python.exe -m unittest discover -s tests -v
.venv\Scripts\python.exe -m py_compile avvia.py collega_github.py
cargo check --manifest-path src-tauri/Cargo.toml --locked
```

## Firma e aggiornamento automatico Tauri

L'updater accetta soltanto pacchetti firmati. La chiave pubblica è nel `tauri.conf.json`; la chiave privata non deve mai entrare nel repository ed è esclusa tramite `.gitignore`.

Configurazione iniziale del maintainer:

1. conserva un backup protetto di `.tauri-secrets/java-linguo.key`: perderla impedisce di aggiornare automaticamente le installazioni esistenti;
2. installa e autentica [GitHub CLI](https://cli.github.com/);
3. esegui `powershell -ExecutionPolicy Bypass -File scripts/configure_updater_secret.ps1`;
4. verifica in **Settings → Secrets and variables → Actions** che esista `TAURI_SIGNING_PRIVATE_KEY`;
5. se la chiave è stata generata con password, aggiungi anche `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

Non stampare mai la chiave privata in log, issue o pull request. Per una nuova chiave usa `npx tauri signer generate --write-keys .tauri-secrets/java-linguo.key`, aggiorna la chiave pubblica in `src-tauri/tauri.conf.json` e pianifica esplicitamente la migrazione: le app già distribuite continuano a fidarsi della chiave precedente.

Avviare poi `avvia.py` e controllare:

- risposta HTTP 200 della pagina principale;
- versione mostrata nell'interfaccia;
- stato corretto di Docker;
- compilazione ed esecuzione di un programma Java nel container;
- rifiuto di un comando non presente nella lista consentita.
- rifiuto di una richiesta priva di origine locale valida;
- interruzione di un programma che supera il limite di output.

## GitHub

Dopo i controlli:

1. creare un commit con il contenuto esatto del rilascio;
2. creare il tag annotato `vMAJOR.MINOR.PATCH` sul commit;
3. pubblicare branch e tag;
4. attendere che la pipeline `Pubblica release` crei la GitHub Release dal tag;
5. verificare che la pagina Releases offra il sorgente ZIP e il tag corretto.
6. verificare che la stessa pipeline pubblichi `.exe`, `.dmg`, `.AppImage`, `.deb` e i relativi checksum.
7. aprire dal `README.md` ogni collegamento di download diretto e verificare che punti all'asset della versione appena pubblicata.
8. verificare che la release contenga `latest.json` e i file `.sig`, inclusi gli archivi updater `.app.tar.gz` per entrambe le architetture macOS;
9. controllare che `latest.json` contenga Windows, Linux, `darwin-aarch64` e `darwin-x86_64`, quindi verificare dall'app della versione precedente che il nuovo aggiornamento venga proposto, scaricato, verificato e installato.

Gli installer devono essere compilati sul sistema operativo di destinazione. Non dichiarare un pacchetto firmato o notarizzato senza aver configurato e verificato i certificati relativi.

Non pubblicare mai `.env`, token, credenziali o cartelle temporanee del laboratorio.
