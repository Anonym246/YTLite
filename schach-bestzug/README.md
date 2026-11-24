# Schach-Bestzug

Kleine Offline-Web-App: Screenshot vom Schachbrett rein → Stellung wird erkannt → **Stockfish** zeigt den besten Zug (mit Pfeil und Top-3-Varianten).

## Starten
`index.html` per Doppelklick im Browser öffnen. Kein Server und kein Internet nötig, Stockfish 10 steckt in `stockfish-src.js`.

## Benutzung
1. **Einmalig kalibrieren:** Screenshot der Grundstellung von deiner Schachseite (chess.com, lichess …) laden, Rechteck um die 64 Felder ziehen, auf **„Als Grundstellung lernen“** klicken.
2. **Stellung erkennen:** Screenshot der aktuellen Stellung laden (Datei, Drag & Drop oder Strg+V), Brett markieren, auf **„Stellung erkennen“** klicken.
3. Falls nötig: Brett rechts korrigieren und **„Korrigiertes Brett lernen“** klicken (verbessert die Erkennung).
4. Einstellen, wer am Zug ist, und auf **„Besten Zug berechnen“** klicken.

Die gelernten Vorlagen werden im Browser gespeichert (localStorage). Sie gelten immer für ein Brett-/Figuren-Design.

## Lizenz
Stockfish ist GPL-3.0 (siehe `STOCKFISH-LICENSE.txt`, Quelle: github.com/niklasf/stockfish.js).
