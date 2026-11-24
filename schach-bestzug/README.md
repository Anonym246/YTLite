# Bestzug

Kleine Offline-Web-App: Du trägst die Züge deiner Partie ein, und wenn du am Zug bist, zeigt dir **Stockfish** den besten Zug als Pfeil.

## Starten
`index.html` im Browser öffnen. Es braucht keinen Server und kein Internet, Stockfish 10 steckt in `stockfish-src.js`.

## Benutzung
1. Farbe wählen (Weiß/Schwarz) → **Los geht's**. Das Brett steht immer mit deiner Farbe unten.
2. Züge eintragen: ins Feld tippen (`e4`, `Sf3`, `exd5`, `O-O`, deutsch oder englisch) oder direkt auf dem Brett ziehen.
3. Bist du dran, zeigt der blaue Pfeil den besten Zug. Mit **Zug ausführen** spielst du ihn direkt.
4. Mit **Zurück** nimmst du Züge zurück. Die Partie bleibt nach dem Neuladen erhalten.

## Lizenzen
- Stockfish: GPL-3.0 (`STOCKFISH-LICENSE.txt`, github.com/niklasf/stockfish.js)
- chess.js: BSD (Header in `chess.js`)
- Figuren: cburnett-Set von Colin M.L. Burnett, CC BY-SA 3.0
