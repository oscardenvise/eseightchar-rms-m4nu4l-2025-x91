# Porymap Mobile

En kartredigerare för decomp-projekt (`pokeemerald`, `pokefirered`, `pokeruby`) som körs
direkt i telefonen. Byggd som en installerbar webbapp så att den kan startas från
hemskärmen på iPhone och iPad, i helskärm och utan nätverk.

Läser samma filer som [porymap](https://github.com/huderlem/porymap) och skriver tillbaka
i samma format, så ett projekt kan flyttas fram och tillbaka mellan telefonen och datorn.

## Kom igång

1. Öppna sidan i Safari.
2. Dela-knappen → **Lägg till på hemskärmen**.
3. Starta från ikonen. Första gången kan du trycka **Öppna demoprojektet** för att prova utan
   att ha ett eget projekt i telefonen.

### Få in ditt eget projekt

1. Lägg `pokeemerald`-mappen i Filer-appen (iCloud Drive fungerar bra).
2. Håll in mappen → **Komprimera**.
3. I appen: **Öppna projekt (.zip)** och välj arkivet.
4. Efter redigering: **Exportera ändrade filer** — du får en liten .zip med bara de filer du
   rört, som packas upp över projektet på datorn.

Räcker inte minnet för hela repot går det bra att zippa enbart mappen `data`.
Appen letar upp projektroten själv, oavsett hur många mappnivåer arkivet har.

## Vad den kan

| Område | Stöd |
| --- | --- |
| Kartor | Alla kartor och grupper ur `map_groups.json`, med sökning |
| Ritning | Pensel med flerrutorsstämpel, hinkfyllning, ersätt alla, pipett |
| Lager | Metatiles, kollision och höjd, events |
| Kant | Redigering av kantrutorna som upprepas utanför kartan |
| Events | Objekt, varp, utlösare och skyltar — flytta i kartan, redigera fält, lägg till, ta bort |
| Kartegenskaper | Musik, väder, karttyp och övriga skalära fält i `map.json` |
| Historik | Ångra/gör om över alla redigeringstyper |
| Visning | Nyp-zoom, panorering, rutnät, kantrutor, anslutningsetiketter |
| Sparning | Skriver `map.bin`, `border.bin` och `map.json` i originalformat |

Den läser tilesets fullt ut: indexerad `tiles.png`, JASC-paletter, `metatiles.bin` med två
eller tre lager, `metatile_attributes.bin` med 1, 2 eller 4 byte per metatile, och den tar
hänsyn till `NUM_TILES_IN_PRIMARY`/`NUM_METATILES_IN_PRIMARY`/`NUM_PALS_IN_PRIMARY` ur
`include/fieldmap.h`. Finns `porymap.project.cfg` läses trippellager, attributstorlek och
egna bitmasker för blockorden därifrån — det som ROM-hackar oftast ändrar.

## Vad den inte gör

Detta är en kartredigerare, inte hela porymap. Följande finns inte:

- Tileset-editorn (rita om metatiles och paletter)
- Wild encounters, regionkartan och skriptredigering
- Att lägga till, ta bort eller storleksändra kartor och layouter
- Att redigera kartanslutningar (de visas som etiketter men går inte att ändra)

## Teknik

Ren HTML, CSS och ES-moduler — inget byggsteg och inga beroenden. ZIP-hanteringen använder
webbläsarens egna `DecompressionStream`/`CompressionStream`, och PNG-avkodaren läser
palettindex direkt ur bildfilen eftersom ett tileset färgar om samma tiles genom upp till
13 olika paletter.

```
porymap-mobile/
├── index.html          appskal
├── styles.css
├── sw.js               offline-cache
├── manifest.webmanifest
└── js/
    ├── zip.js          ZIP-läsning och -skrivning
    ├── png.js          indexerad PNG-avkodning
    ├── project.js      decomp-projektet: layouter, kartgrupper, konstanter
    ├── tileset.js      paletter, tiles, metatile-atlas
    ├── mapdoc.js       öppen karta: blockdata, kant, events, historik
    ├── mapview.js      canvas-rendering och överlager
    ├── viewport.js     nyp-zoom och panorering
    ├── editor.js       ritverktygen
    ├── ui.js           paneler, listor, export
    ├── storage.js      IndexedDB-persistens
    └── demo.js         inbyggt demoprojekt
```

## Köra lokalt

```sh
cd porymap-mobile
python3 -m http.server 8000
```

Öppna `http://<datorns-ip>:8000` i telefonen (samma wifi). Service workern kräver
https eller localhost, så vill du testa offline-läget från telefonen behöver adressen
vara https.

## Riktig iOS-app

Sidan är en PWA, vilket räcker för att köra den från hemskärmen. Vill du ha en signerad
`.ipa` i App Store eller TestFlight går den att wrappa med Capacitor — det kräver en Mac
med Xcode och ett Apple-utvecklarkonto:

```sh
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "Porymap Mobile" com.example.porymap --web-dir=porymap-mobile
npx cap add ios
npx cap open ios
```

Koden i den här mappen behöver inte ändras för det.
