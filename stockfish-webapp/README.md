# Stockfish 19 – Web Analyse

Eine statische Web-App (kein Build-Schritt), die **Stockfish 19** direkt im Browser per WebAssembly ausführt.

## Funktionen
- **Analyse-Modus:** Bewertungsbalken, bis zu 5 Engine-Linien (MultiPV), Pfeile auf dem Brett, einstellbare Tiefe
- **Spiel-Modus:** gegen Stockfish spielen, Stärke 1320–3190 Elo (`UCI_Elo`), Bedenkzeit pro Zug
- Ziehen per Klick oder Drag & Drop, Umwandlungsdialog, Schach/Matt/Patt/Remis-Erkennung
- Zugliste mit Navigation (Pfeiltasten, Pos1/Ende, `F` = Brett drehen), Zug zurücknehmen
- FEN laden/kopieren, PGN importieren/exportieren

## Starten
ES-Module und Web Worker funktionieren nicht über `file://`, daher einen lokalen Server nutzen:

```bash
cd stockfish-webapp
python3 server.py        # -> http://localhost:8000
```

Alternativ funktioniert jeder statische Host (z. B. GitHub Pages), solange `.wasm` als `application/wasm` ausgeliefert wird.

## Engines
| Engine | Größe | Im Repo |
| --- | --- | --- |
| Stockfish 19 Lite (single-threaded) | ≈1,7 MB | ja (`engine/`) |
| Stockfish 19 Full (single-threaded) | ≈94 MB | nein – per Skript laden |

Volle Engine holen (benötigt `npm`):

```bash
./scripts/fetch-full-engine.sh
```

Danach in der App unter *Einstellungen → Engine* auswählen.

## Aufbau
```
index.html          Oberfläche
css/style.css       Styles
js/app.js           App-Logik (Modi, Zugliste, FEN/PGN, Engine-Steuerung)
js/board.js         Schachbrett (Klick/Drag, Pfeile)
js/engine.js        UCI-Wrapper für den Stockfish-Web-Worker
engine/             Stockfish 19 WASM (stockfish.js, GPLv3)
vendor/chess.js     Zugregeln (chess.js 1.4.0, BSD-2)
server.py           Mini-Server mit korrektem WASM-MIME-Type
```

## Lizenzen
- Stockfish: GPLv3 – siehe `engine/COPYING-GPLv3.txt` (Quelle: [official-stockfish/Stockfish](https://github.com/official-stockfish/Stockfish), WASM-Build: [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js))
- chess.js: BSD-2 – siehe `vendor/chess.js-LICENSE`
