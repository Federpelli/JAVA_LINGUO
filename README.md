# JAVA_linguo

[![Versione](https://img.shields.io/badge/versione-0.6.3-006b57)](https://github.com/Federpelli25/JAVA_linguo/releases)
[![Java](https://img.shields.io/badge/Java-25%20LTS-e76f00)](https://www.oracle.com/java/technologies/java-se-support-roadmap.html)
[![Scarica per Windows](https://img.shields.io/badge/Scarica_per_Windows-.exe-0a7c66?logo=windows)](https://github.com/Federpelli25/JAVA_linguo/releases/download/v0.6.3/JAVA_linguo-v0.6.3-windows-x64.setup.exe)
[![Scarica per macOS Apple Silicon](https://img.shields.io/badge/macOS_Apple_Silicon-.dmg-0a7c66?logo=apple)](https://github.com/Federpelli25/JAVA_linguo/releases/download/v0.6.3/JAVA_linguo-v0.6.3-macos-arm64.dmg)
[![Scarica per macOS Intel](https://img.shields.io/badge/macOS_Intel-.dmg-0a7c66?logo=apple)](https://github.com/Federpelli25/JAVA_linguo/releases/download/v0.6.3/JAVA_linguo-v0.6.3-macos-x64.dmg)
[![Scarica il pacchetto Linux](https://img.shields.io/badge/Linux_Debian_Ubuntu-.deb-0a7c66?logo=linux)](https://github.com/Federpelli25/JAVA_linguo/releases/download/v0.6.3/JAVA_linguo-v0.6.3-linux-x64.deb)
[![Scarica AppImage](https://img.shields.io/badge/Linux_portabile-.AppImage-0a7c66?logo=linux)](https://github.com/Federpelli25/JAVA_linguo/releases/download/v0.6.3/JAVA_linguo-v0.6.3-linux-x64.AppImage)

JAVA_linguo è un'applicazione didattica open source per studiare Java con un percorso strutturato: teoria, verifica e laboratorio pratico. Il corso completo comprende **52 lezioni in un percorso guidato**, dai fondamenti a Java 25 e a quattro progetti conclusivi, con un livello di approfondimento simile a un corso universitario. Ogni lezione si sblocca soltanto completando verifica e laboratorio della precedente.

> **Nuovo materiale ogni due settimane.** Il progetto viene aggiornato con lezioni, esercizi, approfondimenti sulle versioni Java e miglioramenti dell'esperienza di studio.

## Installazione rapida

Non devi installare Python, Node.js o Java: l'app contiene già tutto ciò che serve per leggere le lezioni e svolgere le verifiche. Docker è necessario soltanto quando vuoi compilare ed eseguire il codice del laboratorio.

### Download diretto

- **Windows 10/11 a 64 bit:** [⬇ Scarica JAVA_linguo (`.exe`)](https://github.com/Federpelli25/JAVA_linguo/releases/download/v0.6.3/JAVA_linguo-v0.6.3-windows-x64.setup.exe)
- **Mac con chip Apple:** [⬇ Scarica JAVA_linguo (`.dmg` Apple Silicon)](https://github.com/Federpelli25/JAVA_linguo/releases/download/v0.6.3/JAVA_linguo-v0.6.3-macos-arm64.dmg)
- **Mac con processore Intel:** [⬇ Scarica JAVA_linguo (`.dmg` Intel)](https://github.com/Federpelli25/JAVA_linguo/releases/download/v0.6.3/JAVA_linguo-v0.6.3-macos-x64.dmg)
- **Ubuntu, Debian e Mint:** [⬇ Scarica JAVA_linguo (`.deb`)](https://github.com/Federpelli25/JAVA_linguo/releases/download/v0.6.3/JAVA_linguo-v0.6.3-linux-x64.deb)
- **Altre distribuzioni Linux:** [⬇ Scarica JAVA_linguo (`.AppImage`)](https://github.com/Federpelli25/JAVA_linguo/releases/download/v0.6.3/JAVA_linguo-v0.6.3-linux-x64.AppImage)

Ogni collegamento punta direttamente all'installer ufficiale: facendo clic, il browser avvia il download senza richiedere di cercare il file nella pagina Releases.

### 1. Scarica il file corretto

Puoi scaricare ogni installer direttamente da questa tabella. La pagina **[Releases → Latest](https://github.com/Federpelli25/JAVA_linguo/releases/latest)** rimane disponibile per checksum, SBOM e versioni precedenti.

| Sistema | Download diretto | Come scegliere |
| --- | --- | --- |
| Windows 10/11 a 64 bit | [Scarica `.exe`](https://github.com/Federpelli25/JAVA_linguo/releases/download/v0.6.3/JAVA_linguo-v0.6.3-windows-x64.setup.exe) | Scelta corretta per quasi tutti i PC Windows |
| Mac con chip Apple | [Scarica `.dmg` Apple Silicon](https://github.com/Federpelli25/JAVA_linguo/releases/download/v0.6.3/JAVA_linguo-v0.6.3-macos-arm64.dmg) | Per M1, M2, M3, M4 e successivi |
| Mac con processore Intel | [Scarica `.dmg` Intel](https://github.com/Federpelli25/JAVA_linguo/releases/download/v0.6.3/JAVA_linguo-v0.6.3-macos-x64.dmg) | In ** → Informazioni su questo Mac** compare “Intel” |
| Ubuntu, Debian, Mint | [Scarica `.deb`](https://github.com/Federpelli25/JAVA_linguo/releases/download/v0.6.3/JAVA_linguo-v0.6.3-linux-x64.deb) | Installazione integrata nel sistema |
| Altre distribuzioni Linux | [Scarica `.AppImage`](https://github.com/Federpelli25/JAVA_linguo/releases/download/v0.6.3/JAVA_linguo-v0.6.3-linux-x64.AppImage) | File portabile, senza installazione |

I file che terminano con `.sha256` servono a verificare l'integrità: non sono installer.

### 2. Installa e apri JAVA_linguo

#### Windows

1. Apri il file `.setup.exe` scaricato.
2. Completa l'installazione e avvia **JAVA_linguo** dal menu Start.
3. Se SmartScreen mostra un avviso, scegli **Ulteriori informazioni → Esegui comunque** soltanto se il file proviene dalla pagina Releases ufficiale.

#### macOS

1. Apri il file `.dmg` adatto al processore del Mac.
2. Trascina **JAVA_linguo** nella cartella **Applicazioni**.
3. Al primo avvio, se macOS lo blocca, fai clic destro sull'app e scegli **Apri → Apri**.

#### Linux con pacchetto `.deb`

Apri un terminale nella cartella del download ed esegui:

```bash
sudo apt install ./JAVA_linguo-v*-linux-x64.deb
```

#### Linux con AppImage

```bash
chmod +x JAVA_linguo-v*-linux-x64.AppImage
./JAVA_linguo-v*-linux-x64.AppImage
```

Se l'AppImage segnala che manca FUSE, installa il pacchetto `libfuse2` disponibile nella tua distribuzione oppure usa il pacchetto `.deb`.

### 3. Attiva il laboratorio di codice

Puoi usare Teoria e Verifica senza configurazioni aggiuntive. Per i pulsanti **Compila**, **Esegui** e per il terminale:

1. installa [Docker Desktop](https://www.docker.com/products/docker-desktop/) su Windows/macOS oppure Docker Engine su Linux;
2. avvia Docker e attendi che risulti pronto;
3. scarica una sola volta l'immagine Java fissata e verificata:

```text
docker pull eclipse-temurin:25-jdk@sha256:e787e08ef76f4c16866108cd7f9fcd96a68eef3ac6cc76866897d4d02d5a2262
```

Riapri JAVA_linguo: nel Laboratorio lo stato diventerà **Sandbox pronta**. Il terminale integrato accetta solo i comandi Java indicati dall'app e non espone la shell del computer.

### Problemi comuni

| Problema | Soluzione |
| --- | --- |
| Il laboratorio indica che Docker non è disponibile | Avvia Docker Desktop/Engine, attendi lo stato “Running” e riapri l'app |
| L’installer Windows non riesce a scrivere `java-linguo-backend.exe` | Chiudi JAVA_linguo e premi **Riprova**. Dalla versione 0.6.1 l’installer termina automaticamente gli eventuali backend rimasti aperti |
| Windows o macOS avvisano che l'autore non è verificato | Usa esclusivamente la Release GitHub ufficiale e segui il passaggio di apertura descritto sopra |
| Hai scaricato il file sbagliato per Mac | Controlla il processore in ** → Informazioni su questo Mac** e scegli `arm64` oppure `x64` |
| L'AppImage non parte | Rendi il file eseguibile; se manca FUSE, installa `libfuse2` o usa il `.deb` |

Gli installer attuali non sono ancora firmati con un certificato commerciale. Firma Windows e notarizzazione macOS sono previste per una versione futura.

## Cosa offre

- teoria progressiva con esempi, analogie e tracciamento dell'esecuzione;
- percorso sequenziale: una sola nuova lezione disponibile alla volta, con quelle future bloccate;
- verifiche con feedback ragionato;
- editor Java e terminale integrati nel laboratorio;
- esecuzione del codice in un container Docker temporaneo e isolato;
- progressi, codice e appunti indipendenti per ciascuna delle 52 lezioni e salvati soltanto sul dispositivo;
- controllo automatico degli aggiornamenti firmati a ogni avvio dell'app desktop.

Il percorso è diviso in fondamenti, dati e algoritmi, modellazione a oggetti, libreria standard, generics e stile funzionale, concorrenza, ingegneria Java, JVM e prestazioni. Le lezioni 49–52 sono progetti conclusivi: biblioteca a oggetti, analizzatore di file, aggregatore concorrente e applicazione stratificata.

## Alternativa: avvio dal sorgente

Chi preferisce eseguire il progetto direttamente dal codice può usare **Code → Download ZIP** oppure:

```powershell
git clone https://github.com/Federpelli25/JAVA_linguo.git
cd JAVA_linguo
```

Servono Python 3.11 o successivo e Docker. La build web è inclusa nel repository, quindi Node.js non è necessario per studiare.

Su Windows:

```powershell
py -m venv .venv
Copy-Item .env.example .env
.venv\Scripts\python.exe avvia.py
```

È anche possibile fare doppio clic su `AVVIA_JAVA_LINGUO.bat`. Il precedente `AVVIA_STUDIO_JAVA.bat` rimane come alias per chi aggiorna una vecchia installazione.

Su macOS o Linux:

```bash
python3 -m venv .venv
cp .env.example .env
.venv/bin/python avvia.py
```

## Come funziona la sandbox

Il terminale dell'app non espone PowerShell, Prompt dei comandi o la shell del computer. Accetta soltanto:

```text
java --version
javac Main.java
java Main.java
```

Ogni esecuzione avviene in un nuovo container Docker con:

- rete disabilitata;
- processo Java eseguito come utente non-root;
- filesystem del container in sola lettura;
- solo `Main.java` montato in sola lettura, senza condividere repository, Desktop o cartella personale;
- spazio di lavoro in memoria con quota di 32 MB;
- limiti di CPU, memoria, swap, file aperti, processi, output e durata;
- privilegi Linux rimossi e acquisizione di nuovi privilegi disabilitata;
- eliminazione automatica al termine.

L'immagine JDK predefinita è fissata tramite digest, così uno stesso rilascio usa gli stessi byte anche se il tag pubblico viene aggiornato.

Il server locale ascolta esclusivamente su `127.0.0.1` e applica verifiche `Host` e `Origin`, sessione casuale in cookie `HttpOnly`, rate limit, limite di concorrenza e dimensioni massime. Queste protezioni riducono fortemente il rischio, ma la sandbox non è progettata come servizio pubblico multiutente. Esegui soltanto codice che comprendi o proveniente da fonti affidabili. Per segnalazioni riservate consulta [SECURITY.md](SECURITY.md).

## Integrità dei download

Ogni release include checksum SHA-256, SBOM CycloneDX e attestazioni GitHub. Per verificare un installer, confronta il suo hash con il file `.sha256` omonimo. Le pipeline producono separatamente ogni formato sul relativo sistema operativo: gli installer non vengono cross-compilati.

Il repository include inoltre test automatici, lint, build, audit delle dipendenze, CodeQL, Dependency Review e aggiornamenti Dependabot.

## Aggiornamenti e versioni

L'app desktop controlla automaticamente la disponibilità di una nuova versione. Quando trova un aggiornamento mostra note e numero di versione: scegli **Scarica e installa** e JAVA_linguo verifica la firma, installa il pacchetto corretto per il sistema e si riavvia. L'installazione non avviene senza la tua conferma.

> L'updater nasce con la versione 0.6.0: chi usa la 0.5.0 o una versione precedente deve installare manualmente la versione corrente una sola volta. Gli aggiornamenti successivi verranno proposti direttamente nell'app.

La firma dell'updater garantisce l'integrità del pacchetto ma è distinta dalla firma commerciale del produttore; Windows SmartScreen o macOS possono quindi continuare a mostrare l'avviso descritto nell'installazione.

Se usi il progetto dal sorgente tramite Git:

```powershell
git pull
```

I progressi compatibili restano memorizzati sul dispositivo. JAVA_linguo usa [Semantic Versioning](https://semver.org/lang/it/): `MAJOR` per cambiamenti incompatibili, `MINOR` per nuove lezioni o funzionalità e `PATCH` per correzioni.

## Configurazione `.env`

Le opzioni disponibili sono documentate in `.env.example`. Il file `.env` è locale e non viene pubblicato su GitHub. `JAVA_LINGUO_NO_BROWSER=1` disabilita l'apertura automatica del browser quando si usa l'avvio Python.

## Sviluppo

Per modificare l'interfaccia servono Node.js 22.13 o successivo e npm:

```powershell
npm ci --ignore-scripts
npm run lint
npm run course:validate
npm run test:update-errors
npm run build
py -m unittest discover -s tests -v
```

Per creare l'app desktop servono inoltre Rust, i prerequisiti Tauri del sistema e PyInstaller:

```powershell
py -m pip install -r requirements-desktop.txt
npm run desktop:build
```

Le build ufficiali sono generate dalle pipeline `Integrità release` e `Installer desktop`; il push di un tag semantico crea automaticamente la relativa release GitHub, gli installer, le firme e `latest.json` usato dall'updater. La chiave privata Tauri deve essere configurata come secret GitHub seguendo `dev-guides/RILASCI.md`. Prima di sviluppare nuove componenti o lezioni, leggere integralmente le istruzioni in `dev-guides`.

## Repository

[Federpelli25/JAVA_linguo](https://github.com/Federpelli25/JAVA_linguo)
