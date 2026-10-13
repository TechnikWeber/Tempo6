[English](README.md) · **Deutsch**

# Tempo6

Ein Rennspiel für den Browser mit Elektrorollstühlen und Seniorenmobilen. Du startest mit den erlaubten 6 km/h, sammelst auf einem Supermarktparkplatz Pfandflaschen und steckst das Geld in immer fragwürdigeres Tuning, bis 75 km/h.

Stand: erster spielbarer Prototyp (eine Teststrecke, zwei Fahrzeuge, Tuning-Leiter).

## Starten

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # Physik- und Spiellogik-Tests ohne Browser
npm run build    # statischer Build in dist/
```

## Steuerung

| Aktion | Tastatur | Gamepad |
| --- | --- | --- |
| Fahren / lenken | WASD oder Pfeiltasten | Trigger / linker Stick |
| Handbremse | Leertaste | A |
| Nächste Tuning-Stufe kaufen | T | X |
| Aufrichten | R | Y |
| Zurück zum Start | Rücktaste | Back |
| Rollstuhl / Scooter | 1 / 2 | |
| Ton an/aus | M | |
| Werkstatt (Fahrverhalten live einstellen, Cheats) | F2 | |

Auf Touch-Geräten gibt es Bedienelemente auf dem Bildschirm.

## Architektur

- `src/sim/`: Physik und Spielregeln ([Rapier](https://rapier.rs)-Raycast-Fahrzeug, fester 60-Hz-Schritt). Kein Rendering, kein DOM, läuft deshalb in den Tests ohne Browser.
- `src/render/`: [three.js](https://threejs.org)-Szene; alle Modelle entstehen im Code aus Grundformen.
- `src/input/`: Tastatur, Gamepad und Touch werden zu einer Fahrabsicht zusammengeführt.
- `src/config/`: Tuning-Stufen, Fahrzeugdaten und Fahrverhalten.
- `src/tracks/`: Strecken als reine Daten, genutzt von Physik und Darstellung.
