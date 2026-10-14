[English](README.md) · **Deutsch**

# Tempo6

**▶ Im Browser spielen: [technikweber.github.io/Tempo6](https://technikweber.github.io/Tempo6/)** · am Computer oder quer gehaltenem Handy, ohne Installation, ohne Anmeldung.

Ein Rennspiel mit Elektrorollstühlen und Seniorenmobilen. Jedes Gefährt startet mit 12 km/h (laut Prospekt die erlaubten 6) im Reha-Parcours mit Wippe, Wackelbrücke und Schwebebalken. Wer einmal durch ist, bekommt die Drossel raus, verdient sich mit Runden, Rennen und Kunststücken Schrauben und steckt sie in immer fragwürdigeres Tuning, bis 75 km/h.

<p align="center">
  <img src="docs/screenshots/01-startbildschirm.jpg" alt="Startbildschirm mit Gefährten, Modi und Strecken" width="49%">
  <img src="docs/screenshots/03-rennen-startaufstellung.jpg" alt="Startaufstellung im Rennen auf dem Baumarkt-Parkplatz" width="49%">
  <img src="docs/screenshots/02-reha-parcours-wippe.jpg" alt="Rollstuhl auf der Wippe im Reha-Parcours" width="49%">
  <img src="docs/screenshots/04-werk-vordach-haupteingang.jpg" alt="Unter dem Vordach am Haupteingang im Werk Talstadt" width="49%">
  <img src="docs/screenshots/05-altwerk-zug.jpg" alt="Ein Zug fährt am Altwerk vorbei" width="49%">
  <img src="docs/screenshots/06-garage.jpg" alt="Tuning-Garage mit Stufenleiter und Fahrprofilen" width="49%">
</p>

## Was drin ist

- **Modi:** Zeitrennen gegen die Uhr und den eigenen Schatten, Rennen über drei Runden gegen drei Gegner, Freestyle für Stunt-Ketten, dazu experimentell ein Crashtest.
- **Strecken:** Reha-Parcours, Baumarkt-Parkplatz, Kurven-Teststrecke, Werk Talstadt, Altwerk Porta Westfalica, Alter Flugplatz, Spielwiese, Stadionkurs, Große Schleife und das Crashtest-Gelände.
- **Tuning:** acht Stufen bis 75 km/h, Boost-Batterie, drei Fahrprofile je Gefährt, alles auch in der Garage.
- **Spielstand:** bleibt im Browser; über „Speichern“ und „Laden“ auch als Datei, die das Löschen der Browserdaten übersteht.

## Fahrzeuge

Alle Modellnamen sind erfunden, die Fahrzeuge nur lose an echte Produktkategorien angelehnt. Herstellernamen gibt es nicht, nur eine Farbplakette.

Jedes Fahrzeug hat drei Fahrprofile zur Auswahl in der Garage. Solange der Dev-Server läuft, steht die aktuelle Auswahl in `profile-choices.json`.

| Modell | Kategorie | Charakter |
| --- | --- | --- |
| TDFiX | Bordstein-Brecher | Mittelradantrieb, sechs Räder, dreht auf der Stelle |
| Avanti RX | Bordstein-Brecher | Heckantrieb, schnell, mag weite Bögen |
| Avanti FX | Bordstein-Brecher | Frontantrieb, zieht um die Ecke, Heck wedelt |
| Strom4 | Bordstein-Brecher | Schwerer Heckantrieb, sehr standfest |
| Arrivo Karton | Falt(en)wunder | Leichter faltbarer Elektrorollstuhl, flink |
| e-skalation | Power Addons | Radnabenmotoren, Schub in Greifreifen-Stößen |
| e-six(7) | Power Addons | Radnabenmotoren mit Joystick, auf Wunsch Begleitsteuerung |
| Arschtritt 3000 | Power Addons | Schubrad am Heck, Lenken und Bremsen von Hand |
| e-kapitän | Vorderlader | Zuggerät vorn, drei Räder, am schnellsten |
| Kohlibri | Seniorenraketen | Winziges Seniorenmobil, wendig, kippelig |
| Lion | Seniorenraketen | Kompaktes Seniorenmobil |
| Covid Pro | Seniorenraketen | Der Klassiker mit Korb |
| Olivion | Seniorenraketen | Lang, schwer, schnell, riesiger Wendekreis |

Fahrzeuge und Strecken werden mit Schrauben freigeschaltet. Zum Ausprobieren: `?demo` an die Adresse hängen öffnet eine Vorführrunde mit allem freigeschaltet, die nichts speichert.

## Starten

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # Physik- und Spiellogik-Tests ohne Browser
npm run build    # statischer Build in dist/
npm run deploy   # Build nach technikweber.github.io/Tempo6/ veröffentlichen
```

Der Quellcode bleibt in diesem Repo; `npm run deploy` legt nur das gebaute Spiel in den Ordner `Tempo6/` des Blog-Repos, das GitHub Pages ausliefert.

## Steuerung

| Aktion | Tastatur | Gamepad |
| --- | --- | --- |
| Fahren / lenken | WASD oder Pfeiltasten | Trigger / linker Stick |
| In der Luft: drehen und versetzen / Nase kippen, Sprung strecken | Lenken / Gas und Bremse | linker Stick / Trigger |
| Handbremse | Leertaste | A |
| Boost (Autobatterie auf dem Schoß) | Umschalt oder B | B / RB |
| Nächste Tuning-Stufe kaufen | T | X |
| Aufrichten | R | Y |
| Level neu starten | Rücktaste | Back |
| Zurück zum Startbildschirm | Esc | Start |
| Ton an/aus | M | |
| Garage (im Startbildschirm) | T | |
| Werkstatt (Fahrverhalten live einstellen; erst nach Cheatcode) | F2 | |

Auf dem Handy, quer gehalten: links unten die Lenkleiste mit „aufrichten“ und „neu“ darüber, rechts unten Gas (groß), Rückwärts, Handbremse und Boost, oben links das Menü. Im Startbildschirm schaltet „Vollbild“ die Leisten des Browsers weg.

## Architektur

- `src/sim/`: Physik und Spielregeln ([Rapier](https://rapier.rs)-Raycast-Fahrzeug, fester 60-Hz-Schritt). Kein Rendering, kein DOM, läuft deshalb in den Tests ohne Browser.
- `src/render/`: [three.js](https://threejs.org)-Szene; alle Modelle entstehen im Code aus Grundformen.
- `src/input/`: Tastatur, Gamepad und Touch werden zu einer Fahrabsicht zusammengeführt.
- `src/config/`: Tuning-Stufen, Fahrzeugdaten und Fahrverhalten.
- `src/tracks/`: Strecken als reine Daten, genutzt von Physik und Darstellung.
