# Slalom Comp Tävlingshantering

En offline-first webbapplikation som ersätter Excel för att hantera tävlingsdokument
(deltagare, klasser, startlistor, resultat) i slalomskateboard vid internationella
tävlingar — även helt utan internetuppkoppling.

## Grundprincip

**Allt kör lokalt i webbläsaren.** Det finns ingen backend, ingen databasserver och
ingen molntjänst som appen är beroende av. All data (deltagare, klasser, resultat)
lagras i webbläsarens IndexedDB via en riktig SQLite-databas (kompilerad till
WebAssembly med [sql.js](https://github.com/sql-js/sql.js)). En "backup" är bokstavligen
en `.sqlite`-fil du kan spara på USB, skicka via mejl, eller öppna i valfritt
SQLite-verktyg (t.ex. DB Browser for SQLite) om något skulle gå fel.

Internet används **aldrig** för att appen ska fungera under tävlingen. Det enda
internetuppkoppling någonsin behövs för är:
1. Det allra första besöket, så att webbläsaren laddar ner appen (eller `git clone` +
   lokal körning, se nedan).
2. Om ni vill ladda upp/dela en backup-fil efteråt.

## Tre sätt att köra appen helt offline

### Alternativ A — Installera som app (rekommenderas för tävlingsdagen)

1. Öppna appens URL en gång **medan ni har internet** (t.ex. dagen innan tävlingen).
2. I Chrome/Edge: klicka på install-ikonen i adressfältet ("Installera app").
   På Android/iOS: "Lägg till på hemskärmen".
3. Appen är nu installerad som en fristående app. Service workern har cachat
   *alla* filer appen behöver (HTML, JS, CSS, SQLite-motorn). Stäng av wifi/mobildata
   och öppna appen — den fungerar identiskt offline.

### Alternativ B — Kör lokalt på en laptop utan att installera något via nätet

Om laptopen har Node.js installerat sedan tidigare (behöver inte ha internet vid
tävlingstillfället, bara när ni en gång i förväg klonar/bygger detta repo):

```bash
git clone <repo-url>
cd Slalom-Trackmate
npm install
npm run build
npm run serve
```

Öppna sedan `http://localhost:3000` i webbläsaren. `npm run serve` startar en ren
statisk filserver (paketet `serve`) — helt lokal, inget externt beroende, inget
internet krävs efter att `npm install`/`npm run build` en gång körts klart.

### Alternativ C — Öppna direkt som filer (ingen server alls)

```bash
npm run build
```

Öppna sedan `out/index.html` direkt i webbläsaren (dubbelklicka på filen, eller
`file://` i adressfältet). **Obs:** vissa webbläsare blockerar IndexedDB/service
workers för `file://`-sidor av säkerhetsskäl — testa detta i god tid före tävlingen.
Alternativ B eller A är säkrare val.

## Distribution via GitHub Pages (valfritt, för voluntary sync/delning)

Om ni vill hosta appen på en URL (t.ex. för att lätt komma åt den från flera
enheter/webbläsare innan tävlingen), kan GitHub Pages användas eftersom det inte
kräver Vercel eller någon egen server:

1. Om ni hostar på en **GitHub Pages-projektsida** (`https://ditt-användarnamn.github.io/repo-namn/`),
   sätt miljövariabeln vid bygge:
   ```bash
   NEXT_PUBLIC_BASE_PATH="/repo-namn" npm run build
   ```
   Detta krävs eftersom sidan då serveras under en undersökväg, inte domänens rot.
2. Om ni hostar på en **användar-/organisationssida** (`https://ditt-användarnamn.github.io/`)
   eller egen domän, kör bara `npm run build` utan miljövariabeln.
3. Publicera innehållet i `out/`-mappen till grenen `gh-pages` (eller till
   `main`/`docs`-mappen, beroende på hur ni konfigurerar Pages i repo-inställningarna).

En enkel GitHub Actions-workflow för detta finns i `.github/workflows/deploy-pages.yml`.

## Teknisk arkitektur i korthet

| Del | Val | Varför |
|---|---|---|
| Ramverk | Next.js (App Router), `output: "export"` | Ren statisk export — ingen Node-server behövs vid körning |
| Databas | sql.js (SQLite via WebAssembly) | Riktig SQL, och en `.sqlite`-fil *är* backupen |
| Lagring | IndexedDB (databasen serialiserad som en blob) | Överlever stängd flik/webbläsare |
| Offline | Service worker, installationsbaserad precache | Fungerar helt utan nätverk efter första besöket |
| Import | ExcelJS (.xlsx) + PapaParse (.csv) | UTF-8-säker hantering av å/ä/ö, ñ, ã, ç |
| Export | ExcelJS, PapaParse (med UTF-8 BOM), jsPDF | Excel/CSV/PDF helt offline, ingen server-rendering |
| Språk | Svenska, Engelska, Spanska, Portugisiska | Byggd egen i18n-lösning, ingen extern tjänst |

## Vad som INTE är byggt (medvetet, se hårda krav)

- **Ingen automatisk synkning mellan enheter.** Appen är utformad för en (1) enhet
  under själva tävlingen (beslutat i projektets kravdialog). Backup-/återställnings-
  funktionen i Import/Export-sidan kan användas manuellt om ni ändå vill flytta data
  mellan enheter.
- **Ingen bakgrundssynk till någon molntjänst.** All eventuell synk är en medveten,
  manuell handling — aldrig något som kan störa under pågående tävling.

## Utveckling

```bash
npm install
npm run dev      # utvecklingsserver på http://localhost:3000 (kräver Node, inte för tävlingsbruk)
npm run build    # bygger den statiska exporten till out/
npm run serve    # serverar out/ lokalt utan Next.js-serverberoende
npm run lint     # ESLint
```

## Datamodell

Se `lib/db/schema.ts` för det fullständiga SQL-schemat. Huvudtabeller:
`classes`, `participants`, `heats`, `heat_participants`, `results`.

## Känd begränsning att testa innan tävling

sql.js håller hela databasen i minnet och serialiserar den till IndexedDB vid varje
sparning (debounced, ~400 ms). Detta är snabbt för hundratals deltagare (typisk
tävlingsstorlek) men har inte belastningstestats för tiotusentals rader. Testa gärna
med er förväntade deltagarmängd i god tid.
