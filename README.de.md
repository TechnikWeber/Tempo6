[English](README.md) · **Deutsch**

# Tempo6

Ein Rennspiel für den Browser mit Elektrorollstühlen und Seniorenmobilen. Du startest mit den erlaubten 6 km/h, sammelst auf einem Supermarktparkplatz Pfandflaschen und steckst das Geld in immer fragwürdigeres Tuning, bis 75 km/h.

Stand: spielbarer Prototyp mit Startbildschirm, zwei Strecken, dreizehn Fahrzeugen und Tuning-Leiter.

## Fahrzeuge

Alle Modellnamen sind erfunden, die Fahrzeuge nur lose an echte Produktkategorien angelehnt. Herstellernamen gibt es nicht, nur eine Farbplakette.

Jedes Fahrzeug hat drei Fahrprofile zur Auswahl in der Werkstatt (F2). Solange der Dev-Server läuft, steht die aktuelle Auswahl in `profile-choices.json`.

| Modell | Kategorie | Charakter |
| --- | --- | --- |
| T-Rex Mitteldreher | Vollpower Wheelchairs | Mittelradantrieb, sechs Räder, dreht auf der Stelle |
| Avanti RX | Vollpower Wheelchairs | Heckantrieb, schnell, mag weite Bögen |
| Avanti FX | Vollpower Wheelchairs | Frontantrieb, zieht um die Ecke, Heck wedelt |
| Orkan 4 | Vollpower Wheelchairs | Schwerer Heckantrieb, sehr standfest |
| Arrivo Karton | One-Piece-Falter | Leichter faltbarer Elektrorollstuhl, flink |
| e-skalation | Schubshilfen | Radnabenmotoren, Schub in Greifreifen-Stößen |
| e-nix | Schubshilfen | Radnabenmotoren mit Joystick, auf Wunsch Begleitsteuerung |
| schubs one | Schubshilfen | Schubrad am Heck, Lenken und Bremsen von Hand |
| e-käpt'n | Zugmaschinen | Zuggerät vorn, drei Räder, am schnellsten |
| Piepmatz | Rentnerblitze | Winziges Seniorenmobil, wendig, kippelig |
| Stubentiger | Rentnerblitze | Kompaktes Seniorenmobil |
| Sternschnuppe 4 | Rentnerblitze | Der Klassiker mit Korb und Wimpel |
| Großer Wagen | Rentnerblitze | Lang, schwer, schnell, riesiger Wendekreis |

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
| Boost (LKW-Batterie auf dem Schoß) | Umschalt oder B | B / RB |
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
