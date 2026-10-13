[English](README.md) · **Deutsch**

# Tempo6

Ein Rennspiel für den Browser mit Elektrorollstühlen und Seniorenmobilen. Du startest mit den erlaubten 6 km/h, sammelst auf einem Supermarktparkplatz Pfandflaschen und steckst das Geld in immer fragwürdigeres Tuning, bis 75 km/h.

Stand: spielbarer Prototyp mit Startbildschirm, zwei Strecken, zwölf Fahrzeugen und Tuning-Leiter.

## Fahrzeuge

Alle Hersteller und Modelle sind erfunden und nur lose an echte Produktkategorien angelehnt.

| Modell | Kategorie | Charakter |
| --- | --- | --- |
| Invascare T-Rex Mitteldreher | Vollpower Wheelchairs | Mittelradantrieb, sechs Räder, dreht auf der Stelle |
| Invascare Avanti RX | Vollpower Wheelchairs | Heckantrieb, schnell, mag weite Bögen |
| Invascare Avanti FX | Vollpower Wheelchairs | Frontantrieb, zieht um die Ecke, Heck wedelt |
| Invascare Orkan 4 | Vollpower Wheelchairs | Schwerer Heckantrieb, sehr standfest |
| Albern Arrivo Karton | One-Piece-Falter | Leichter faltbarer Elektrorollstuhl, flink |
| Albern e-skalation | Schubshilfen | Radnabenmotoren, Schub in Greifreifen-Stößen |
| Albern schubs one | Schubshilfen | Schubrad am Heck, Lenken und Bremsen von Hand |
| Albern e-käpt'n | Zugmaschinen | Zuggerät vorn, drei Räder, am schnellsten |
| Invascare Piepmatz | Rentnerblitze | Winziges Seniorenmobil, wendig, kippelig |
| Invascare Stubentiger | Rentnerblitze | Kompaktes Seniorenmobil |
| Invascare Sternschnuppe 4 | Rentnerblitze | Der Klassiker mit Korb und Wimpel |
| Invascare Großer Wagen | Rentnerblitze | Lang, schwer, schnell, riesiger Wendekreis |

Fahrzeuge und Strecken werden mit Pfand freigeschaltet; `UNLOCK_ALL` in `src/config/vehicles.ts` öffnet zum Testen alles.

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
| Level neu starten | Rücktaste | Back |
| Zurück zum Startbildschirm | Esc | Start |
| Ton an/aus | M | |
| Werkstatt (Fahrverhalten live einstellen, Cheats) | F2 | |

Auf Touch-Geräten gibt es Bedienelemente auf dem Bildschirm.

## Architektur

- `src/sim/`: Physik und Spielregeln ([Rapier](https://rapier.rs)-Raycast-Fahrzeug, fester 60-Hz-Schritt). Kein Rendering, kein DOM, läuft deshalb in den Tests ohne Browser.
- `src/render/`: [three.js](https://threejs.org)-Szene; alle Modelle entstehen im Code aus Grundformen.
- `src/input/`: Tastatur, Gamepad und Touch werden zu einer Fahrabsicht zusammengeführt.
- `src/config/`: Tuning-Stufen, Fahrzeugdaten und Fahrverhalten.
- `src/tracks/`: Strecken als reine Daten, genutzt von Physik und Darstellung.
