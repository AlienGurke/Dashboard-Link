# Dashboard-Link

Ein Dashboard für deine Spielzeit – aus den Daten von [3DS Link](https://github.com/AlienGurke/3DS-Link)
(und später auch [Azahar-Link](https://github.com/AlienGurke/Azahar-Link) und
[melonDS-Link](https://github.com/AlienGurke/melonDS-Link)).

**Öffnen:** <https://aliengurke.github.io/Dashboard-Link/> – oder `Dashboard-Link.html` aus dem neuesten
[Build](../../actions) herunterladen und per Doppelklick öffnen (geht auch ganz ohne Internet).

Dann den Ordner `activity` von der SD-Karte (`sdmc:/3ds/3DS-Link/activity`) hineinziehen oder auswählen –
oder eine ZIP davon. Mehrere Konsolen: einfach mehrere `activity`-Ordner zusammen hineinziehen.

## Deine Daten bleiben bei dir

Die Seite liest die Dateien nur im Browser. Nichts wird hochgeladen, es werden keine anderen
Server angesprochen (keine Schriften, keine Statistik, kein Tracking) – die Seite verbietet sich
das selbst (Content-Security-Policy `connect-src 'none'`). Spielnamen und -bilder kommen nur aus
deinem eigenen Ordner.

## Ansichten

- **Profil** – zuletzt gespielt, die letzten 2 Wochen, alle Spiele mit Spielzeit.
- **Klassisch** – Software-Album und Statistiken *(kommt)*.
- **Übersicht** – Rückblicke, Kalender, Sitzungen *(kommt)*.

## Woher die Zahlen kommen

Die Formate der Dateien beschreibt
[docs/activity-log-archive.md](https://github.com/AlienGurke/3DS-Link/blob/master/docs/activity-log-archive.md)
im 3DS-Link-Repo. Kurz:

- Ab dem Beginn des Spielzeit-Logs (`playhistory.bin`) werden Sitzungen minutengenau berechnet:
  Start/Fortsetzen bis Pausieren/Beenden, Standby zählt nicht, nur was gerade im Vordergrund ist.
- Davor kommen die Stundenwerte der Aktivitätslog-App (`pld.dat`).
- Uhr-Umstellungen werden herausgerechnet: Zeitsprünge über 3DS Link (`clock.txt`), und eine
  zurückgesetzte Uhr (leerer Akku → 2011) anhand der Uhr-Ereignisse, die der 3DS selbst einträgt.
  Was sich nicht sicher zuordnen lässt, zählt zur Spielzeit, aber zu keinem Tag.

## Entwickeln

```
npm ci
npm run dev      # lokal
npm run build    # dist/index.html – eine einzige Datei
```
