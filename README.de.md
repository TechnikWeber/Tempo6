[English](README.md) · **Deutsch**

# Tempo6

Ein Rennspiel für den Browser mit Elektrorollstühlen und Seniorenmobilen. Du startest mit den erlaubten 6 km/h, sammelst auf einem Supermarktparkplatz Pfandflaschen und steckst das Geld in immer fragwürdigeres Tuning, bis 75 km/h.

Stand: spielbarer Prototyp mit Startbildschirm, zwei Strecken, sieben Fahrzeugen und Tuning-Leiter.

## Fahrzeuge

Alle Hersteller und Modelle sind erfunden und nur lose an echte Produktkategorien angelehnt.

| Modell | Bauart | Charakter |
| --- | --- | --- |
| Rasicare T-Rex Mitteldreher | Elektrorollstuhl, Mittelradantrieb | Sechs Räder, dreht auf der Stelle |
| Rasicare Avanti RX | Elektrorollstuhl, Heckantrieb | Schnell, mag weite Bögen |
| Rasicare Orkan 4 | Schwerer Elektrorollstuhl, Heckantrieb | Kommt langsam in Fahrt, sehr standfest |
| Halber e-skalation | Faltrollstuhl mit Radnabenmotoren | Leicht, zappelig, Schub in Greifreifen-Stößen |
| Halber schubs one | Faltrollstuhl mit Schubrad am Heck | Lenken und Bremsen von Hand |
| Halber e-käpt'n | Faltrollstuhl mit Zuggerät vorn | Drei Räder, am schnellsten, kippt leicht |
| Rentnerblitz Komet 4 | Seniorenmobil | Lenkt wie ein Auto |

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
