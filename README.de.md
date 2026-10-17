[English](README.md) · **Deutsch**

# Tempo6

**▶ Im Browser spielen: [technikweber.github.io/Tempo6](https://technikweber.github.io/Tempo6/)** · am Computer oder quer gehaltenem Handy, ohne Installation, ohne Anmeldung.

Ein Rennspiel mit Elektrorollstühlen und Seniorenmobilen. Jedes Gefährt startet mit 12 km/h (laut Prospekt die erlaubten 6) im Reha-Parcours mit Wippe, Wackelbrücke und Schwebebalken. Wer einmal durch ist, bekommt die Drossel raus, verdient sich mit Runden, Rennen und Kunststücken Schrauben und steckt sie in immer fragwürdigeres Tuning, bis 75 km/h. Das Spiel ist auf Englisch und mit einem Knopf im Startbildschirm auf Deutsch umschaltbar.

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
- **Strecken:** Reha-Parcours, Baumarkt-Parkplatz, Werk Talstadt, Himmelspfad, Altwerk Porta Westafrika, Alter Flugplatz, Spielwiese, Stadionkurs, Große Schleife und das Crashtest-Gelände.
- **Tuning:** acht Stufen bis 75 km/h, Boost-Batterie, drei Fahrprofile je Gefährt, alles auch in der Garage.
- **Spielstand:** bleibt im Browser; über „Speichern“ und „Laden“ auch als Datei, die das Löschen der Browserdaten übersteht; „Spielstand löschen“ in den Einstellungen fängt von vorn an.
- **Ton:** entsteht im Browser, ohne Audiodateien: die Motoren, die Stöße und eine 8-Bit-Melodie im Startbildschirm und in der Garage („🎵 Musik“ in den Einstellungen schaltet sie ab, M allen Ton).

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
| e-six Seven | Power Addons | Radnabenmotoren mit Joystick, auf Wunsch Begleitsteuerung |
| Arschtritt 3000 | Power Addons | Schubrad am Heck, Lenken und Bremsen von Hand |
| Sprite | Power Addons | Elektrorollstuhl mit starrem Rahmen, nicht faltbar, ruhiger |
| e-kapitän | Vorderlader | Zuggerät vorn, drei Räder, am schnellsten |
| Kohlibri | Seniorenraketen | Winziges Seniorenmobil, wendig, kippelig |
| Lion | Seniorenraketen | Kompaktes Seniorenmobil |
| Covid Pro | Seniorenraketen | Der Klassiker mit Korb |
| Olivion | Seniorenraketen | Lang, schwer, schnell, riesiger Wendekreis |
| Skandalmobil | Getunte Treppensteiger | Treppensteiger mit Sitz, für Rennen umgebaut: Opa sitzt vorn, Oma lässt sich auf Rollschuhen ziehen |

Fahrzeuge und Strecken werden mit Schrauben freigeschaltet. Zum Ausprobieren: `?demo` an die Adresse hängen öffnet eine Vorführrunde mit allem freigeschaltet, die nichts speichert.

## Starten

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # Physik- und Spiellogik-Tests ohne Browser
npm run build    # statischer Build in dist/
```

Jeder Push auf `main` testet, baut und veröffentlicht das Spiel über GitHub Pages (`.github/workflows/pages.yml`). Der Spielstand liegt im Browser unter der Adresse technikweber.github.io.

## Steuerung

| Aktion | Tastatur | Controller: Switch-Layout (8BitDo) | Xbox | PlayStation |
| --- | --- | --- | --- | --- |
| Fahren / lenken | WASD oder Pfeiltasten | ZR / ZL, linker Stick oder Steuerkreuz | RT / LT, linker Stick oder Steuerkreuz | R2 / L2, linker Stick oder Steuerkreuz |
| In der Luft: drehen und versetzen / Nase kippen, Sprung strecken | Lenken / Gas und Bremse | linker Stick / ZR, ZL | linker Stick / RT, LT | linker Stick / R2, L2 |
| Handbremse | Leertaste | B | A | ✕ |
| Boost (Autobatterie auf dem Schoß) | Umschalt oder B | A oder R | B oder RB | ○ oder R1 |
| Aufrichten | R | X | Y | △ |
| Level neu starten | Rücktaste | − | View | Share |
| Zurück zum Startbildschirm | Esc | + | Menu | Options |
| Ton an/aus | M | | | |
| Garage (im Startbildschirm) | T | X | Y | △ |
| Werkstatt (Fahrverhalten live einstellen; mit Dev-Mode in den Einstellungen) | F2 | | | |

Im Startbildschirm macht der Controller, was die Tasten machen: links und rechts wählen das Gefährt, hoch und runter die Strecke, die Schultertasten den Modus, A (Xbox A, ✕) startet, Y (Xbox X, □) schaltet frei, was gerade gewählt ist, und − (View, Share) öffnet die Einstellungen. In der Garage und den Einstellungen wandert mit dem Steuerkreuz eine Markierung, A drückt, B geht zurück. Das Bild nennt die Tasten von dem, was zuletzt benutzt wurde: die Tastatur oder den Controller mit seiner eigenen Beschriftung. Controller erkennt das Spiel am Hersteller: Ein 8BitDo im eigenen Modus ist der Standard, und alles Unbekannte wird dafür gehalten; Switch Pro, Xbox und PlayStation bekommen ihre eigenen Tastennamen. Liegt es daneben, wählt „🎮 Controller“ in den Einstellungen von Hand. Den Ton lassen Browser erst nach einem Klick oder Tastendruck an, nicht nach einer Controller-Taste: also einmal ins Spiel klicken.

Auf dem Handy, quer gehalten: links unten die Lenkleiste mit „aufrichten“ und „neu“ darüber, rechts unten Gas (groß), Rückwärts, Handbremse und Boost, oben links das Menü. Im Startbildschirm schaltet „Vollbild“ die Leisten des Browsers weg.

## Architektur

- `src/sim/`: Physik und Spielregeln ([Rapier](https://rapier.rs)-Raycast-Fahrzeug, fester 60-Hz-Schritt). Kein Rendering, kein DOM, läuft deshalb in den Tests ohne Browser.
- `src/render/`: [three.js](https://threejs.org)-Szene; alle Modelle entstehen im Code aus Grundformen.
- `src/input/`: Tastatur, Controller und Touch werden zu einer Fahrabsicht zusammengeführt; `pads.ts` enthält die Controller-Profile.
- `src/config/`: Tuning-Stufen, Fahrzeugdaten und Fahrverhalten.
- `src/tracks/`: Strecken als reine Daten, genutzt von Physik und Darstellung.
