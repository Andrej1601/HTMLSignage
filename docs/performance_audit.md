# Performance- und Zuverlässigkeitsprüfung

Diese Notizen fassen die wichtigsten Stellen mit Optimierungspotenzial oder Laufzeitrisiken aus dem aktuellen Stand des Repos zusammen. Die Punkte sind nach Priorität sortiert.

## 1. Installer überschreibt produktive Daten (hoch)
Das Installationsskript synchronisiert den kompletten Inhalt von `webroot/` per `rsync -a` in das Zielverzeichnis. Dabei wird auch der Ordner `webroot/data` mitsamt Beispiel-Schedule und -Settings übertragen und vorhandene Dateien im Ziel überschrieben.【F:scripts/install.sh†L184-L193】 In einer bestehenden Installation führt ein erneuter Lauf des Skripts so zu Datenverlust.

**Vorschlag:** Beim Kopieren den Datenordner explizit ausschließen (z. B. `rsync -a --exclude 'data/'`), bzw. nur dann initial befüllen, wenn die Dateien im Ziel noch fehlen. Zusätzlich sollte der Schritt im Log darauf hinweisen, falls bestehende Dateien ausgelassen werden.

## 2. Geräte-Endpunkte behandeln Schreibfehler nicht (hoch)
Mehrere API-Endpunkte verlassen sich darauf, dass `devices_save()` bei einem Fehler `false` zurückgibt. Die Funktion wirft allerdings eine `RuntimeException`, wenn `file_put_contents` scheitert.【F:webroot/admin/api/devices_store.php†L704-L718】 Dadurch endet der Request mit einem 500er und ohne JSON-Fehlermeldung. Betroffen sind u. a. `devices_gc.php`, `devices_set_mode.php`, `devices_unpair.php` und `devices_save_override.php`.【F:webroot/admin/api/devices_gc.php†L1-L46】【F:webroot/admin/api/devices_set_mode.php†L1-L41】【F:webroot/admin/api/devices_unpair.php†L1-L42】【F:webroot/admin/api/devices_save_override.php†L1-L52】

**Vorschlag:** Jeden dieser Endpunkte in einen `try { devices_save(...); } catch (RuntimeException $e) { … }` Block hüllen und konsistente JSON-Antworten inkl. Logging liefern, so wie es `devices_touch.php` bereits vormacht.

## 3. Live-Stream berechnet Hashes im 500 ms-Takt (mittel)
Der Server-Sent-Events-Handler `webroot/api/live.php` ruft in der Hauptschleife für jede überwachte Datei `sha1_file()` auf.【F:webroot/api/live.php†L33-L200】 Da die Schleife alle 500 ms läuft, muss PHP die JSON-Dateien (`settings`, `schedule`, `devices`) fortlaufend komplett einlesen. Bei größeren Datenbeständen oder vielen gleichzeitigen Streams erzeugt das vermeidbaren I/O- und CPU-Druck.

**Vorschlag:** Änderungsprüfungen zunächst nur über `filemtime`/`filesize` durchführen und den Hash erst berechnen, wenn sich der Zeitstempel ändert oder im Bedarfsfall ganz darauf verzichten. Alternativ das Polling-Intervall erhöhen oder einen `inotify`-basierten Ansatz vorsehen.
