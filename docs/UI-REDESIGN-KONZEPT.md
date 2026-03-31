# HTMLSignage Admin UI Redesign - Konzeptdokumentation

> Erstellt: 2026-03-31 | Stitch-Projekt-ID: `9411312541944602204`
> Design System Asset: `assets/18400072296702127310`

---

## 1. Analyse des aktuellen UI

### 1.1 Bestandsaufnahme

Die Adminoberflaeche besteht aus **8 Hauptscreens** (+ 3 Auth-Seiten + Display-Client):

| Screen | Route | Zweck |
|--------|-------|-------|
| Dashboard | `/` | Operations-Hub mit Widgets |
| Aufgussplan | `/schedule` | Grid-basierter Zeitplan-Editor |
| Geraete | `/devices` | Device Pairing & Monitoring |
| Slideshow | `/slideshow` | Content-Editor mit Workflow |
| Medien | `/media` | Media Library mit Upload |
| Saunen | `/saunas` | Sauna-Stammdaten mit Drag&Drop |
| Einstellungen | `/settings` | 7-Tab Konfigurationsseite |
| Benutzer | `/users` | RBAC Benutzerverwaltung |

### 1.2 Staerken des aktuellen UI

- **Solide Komponentenbibliothek**: Button, Dialog, ConfirmDialog, DataTable, SectionCard, StatusBadge, EmptyState, Skeleton - alle konsistent gebaut
- **Permission-System**: Feingranulares RBAC mit Route-Guards und UI-Gating
- **Draft-Recovery**: Autosave + Recovery-Banner fuer Schedule und Settings
- **Keyboard-Support**: Command Palette (Cmd+K), Skip-to-Content
- **Responsive Grundstruktur**: Sidebar kollabiert auf Mobile
- **Echtzeit-Updates**: WebSocket-Status-Indikator in Sidebar

### 1.3 Identifizierte Schwaechen

#### A. Informationsarchitektur
- **PageHeader ueberladen**: Jeder Screen zeigt 4-5 Status-Badges im Header, die schwer scanbar sind. Devices zeigt z.B. "7 gekoppelt", "5 online", "2 offline", "0 Wartung", "1 pending" - zu viel auf einmal.
- **Settings als Mega-Screen**: 7 Tabs (Theme, Audio, Aromen, Infos, Wartungsscreen, Events, System) in einem Screen. Kein klarer Fokus, keine Trennung zwischen Content-Settings und System-Administration.
- **Dashboard Widget-Overload**: 10+ Widgets mit konfigurierbarer Sichtbarkeit. Nutzer muss selbst konfigurieren statt sinnvoller Defaults.
- **StatCards ueberall**: Dashboard, Devices, Media, Users nutzen alle StatCards - aber inkonsistent. Mal 4er-Grid, mal 5er-Grid, mal 2er-Grid.

#### B. Visuelle Konsistenz
- **Farbsystem inkonsistent**: Tailwind-Config definiert `spa-*` Custom-Colors, aber daneben gibt es `theme.constants.ts` mit dynamischen Paletten + named Palettes. Zwei parallele Farbsysteme.
- **Card-Varianten unklar**: `SectionCard` vs. `StatCard` vs. `DashboardWidgetFrame` vs. `QuickActionCard` - zu viele Card-Typen ohne klare Hierarchie.
- **Gradient-Hintergrund**: `bg-gradient-to-br from-spa-bg-primary via-white to-spa-bg-primary/80` als Page-Background wirkt unruhig und unprofessionell fuer eine Admin-Oberflaeche.
- **Keine konsistenten Spacing-Tokens**: Mal `space-y-4`, mal `space-y-6`, mal `gap-4`, mal `gap-6`. Kein einheitliches Raster.

#### C. Navigation & Layout
- **Sidebar-Beschreibungstexte**: Jeder Nav-Item hat einen Beschreibungstext ("Live-Lage, Warnungen und Betriebsfokus.") der Platz verbraucht aber selten gelesen wird. Auf Desktop unsichtbar, nur auf Mobile sichtbar.
- **Breadcrumbs ohne Tiefe**: Die App hat nur 1 Navigationsebene. Breadcrumbs zeigen immer nur "Dashboard > Aufgussplan" etc. - kein Mehrwert.
- **Kein Active-State-Feedback**: Die Sidebar zeigt den aktiven Nav-Item mit weissem Background, aber der runde Dot rechts ist kein gaengiges Pattern und verwirrt.

#### D. UX-Patterns
- **Inline-Editing vs. Dialog-Editing inkonsistent**: Saunen nutzen Dialog-Editor, Schedule nutzt CellEditor-Modal, Slideshow nutzt Panel-basiertes Editing. Kein einheitliches Pattern.
- **Filter-UX inkonsistent**: Devices nutzt Toggle-Pills, Media nutzt Dropdown + Text-Search, Users nutzt nur Text-Search. Kein einheitliches Filter-Pattern.
- **Kein Bulk-Actions-Pattern**: Devices erwahnt "Bulk-Aktionen" im Header, aber es gibt keine Checkbox-Selektion oder Bulk-Action-Bar.
- **Error-States fragmentiert**: `ErrorAlert` als eigene Komponente, aber auch inline Fehler in Forms, plus Toast-Notifications via Zustand. Drei Error-Channels.

#### E. Technische Altlasten
- **Dual HTTP Client**: Axios-Instance UND `fetchApi()` Wrapper existieren parallel
- **ESLint-Konflikt**: Legacy `.eslintrc.cjs` wurde gerade erst entfernt, `eslint.config.mjs` ist aktiv
- **StatCard in Dashboard-Ordner**: Die `StatCard`-Komponente liegt unter `/components/Dashboard/` wird aber von Devices, Media, Users importiert - falscher Scope

---

## 2. Zielbild & Designrichtung

### 2.1 Design-Vision

**"Professional Control Center"** - Eine aufgeraeumte, datendichte Admin-Oberflaeche, die wie ein professionelles Kontrollzentrum fuer Digital Signage wirkt. Klar, schnell erfassbar, statusorientiert.

### 2.2 Design-Prinzipien

1. **Klarheit vor Dekoration**: Kein Gradient-Background, keine ueberfluessigen Badges. Flache, helle Oberflaeche mit klarer Hierarchie.
2. **Scanbarkeit**: KPIs und Status muessen auf einen Blick erfassbar sein. Weniger ist mehr.
3. **Konsistenz**: Ein Pattern fuer Filter, ein Pattern fuer Tabellen, ein Pattern fuer Edit-Dialoge. Durchgaengig.
4. **Kontextuelle Information**: Daten werden dort gezeigt, wo sie gebraucht werden. Kein Widget-Konfigurator notwendig.
5. **Progressive Disclosure**: Komplexitaet wird schrittweise aufgedeckt. Einfache Ansicht als Default, Details bei Bedarf.

### 2.3 Farbsystem (konsolidiert)

```
Primary:     #8B6F47  (Warm Brown - Brand, CTAs, Active States)
Secondary:   #7FA99B  (Sage Green - Success-adjacent, Content-Bereich)
Accent:      #D4A574  (Gold - Highlights, Hover)

Background:  #F9F7F4  (Off-White - Page Background)
Surface:     #FFFFFF  (White - Cards, Panels)
Border:      #EDE9E3  (Light Beige - Card Borders, Dividers)

Text Primary:    #2C2416  (Dark Brown)
Text Secondary:  #5A4E3F  (Mid Brown)
Text Muted:      #8B7F6F  (Light Brown - Placeholders, Hints)

Status:
  Success:   #10B981 / #D1FAE5 / #047857
  Warning:   #F59E0B / #FEF3C7 / #B45309
  Error:     #EF4444 / #FEE2E2 / #B91C1C
  Info:      #3B82F6 / #DBEAFE / #1D4ED8
```

### 2.4 Typografie

- Headlines: **Inter SemiBold**, 24-28px (nicht 32px - zu gross fuer Admin)
- Body: **Inter Regular**, 14px
- Labels/Captions: **Inter Medium**, 12px, uppercase tracking fuer Section-Headers
- Monospace: System mono fuer IDs, Codes, Timestamps

### 2.5 Spacing-System

```
xs:  4px   (inline gaps)
sm:  8px   (tight spacing)
md:  16px  (component padding, standard gap)
lg:  24px  (section gaps)
xl:  32px  (page margins)
2xl: 48px  (major section breaks)
```

### 2.6 Navigationslogik (Vorschlag)

**Beibehaltung der 3-Section-Sidebar**, aber vereinfacht:

```
BETRIEB
  Dashboard        (Home)
  Aufgussplan      (Calendar)
  Geraete          (Monitor)

INHALTE
  Slideshow        (Presentation)
  Medien           (Image)
  Saunen           (Flame)

SYSTEM
  Einstellungen    (Settings)     -- nur Theme, Audio, Aromen, Infos, Events
  Administration   (Shield)       -- Benutzer, Backups, Updates, Audit-Log (NEU)
```

**Aenderung**: "Benutzer" und der System-Tab der Settings werden zu einem neuen Screen "Administration" zusammengefasst. Das trennt Content-Konfiguration (Einstellungen) von System-Administration (Administration) sauber.

---

## 3. Screen-Konzepte

### 3.1 Dashboard (Operations Hub)

**Stitch-Screen**: `abfd972e33654b7685dcbd10caeaa5dd` + `7c1acd30448a41df81c8dc49bebe89ea`

**Zweck**: Ueberblick ueber den aktuellen Betriebszustand. Einstiegspunkt nach Login.

**Hauptnutzeraktionen**:
- Betriebsstatus auf einen Blick erfassen
- Warnungen und Probleme erkennen
- Zu Detailseiten navigieren

**Layoutstruktur**:
```
+--------------------------------------------------+
| Page Header: Dashboard                            |
| "Betriebsuebersicht" | [Widget-Filter Dropdown]  |
+--------------------------------------------------+
| [Operations Pulse]        | [Attention Board]     |
| - Aktiver Preset          | - Offline-Geraete     |
| - Auto-Play Status        | - Disk-Warnung        |
| - Event-Info              | - Verwaiste Medien    |
| - 3 KPI-Metrics inline    |                       |
+---------------------------+-----------------------+
| [System Health]    | [Media Stats] | [Activity]  |
| - DB: OK           | - 45 Bilder   | - Timeline  |
| - WebSocket: OK    | - 8 Audio     | - Feed      |
| - Disk: 78%        | - 3 Video     |             |
| - Version: 2.4.1   | - 2.1 GB      |             |
+--------------------+-------------+---------------+
| [Running Slideshows]                              |
| Device | Slideshow | Slides | Last Sync           |
+--------------------------------------------------+
```

**Empfohlene Komponenten**: StatCard (kompakt), WidgetFrame, HealthCheckRow, ActivityItem, SlideshowStatusRow

**UX-Begruendung**: Der Dashboard sollte NICHT konfigurierbar sein muessen. Stattdessen zeigt er die 5-6 wichtigsten Widgets in fester Reihenfolge. Der Widget-Visibility-Toggle wird entfernt - er loest ein Problem, das durch besseres Default-Layout nicht existieren sollte.

**Quick Win**: Gradient-Background durch flaches `bg-spa-bg-primary` ersetzen. StatCards von 5er-Grid auf 3 inline KPIs im Operations-Widget reduzieren.

---

### 3.2 Geraete (Device Management)

**Stitch-Screen**: `e1666c7af0214bb195bfd72d222adb0b`

**Zweck**: Alle gekoppelten Displays verwalten, Status ueberwachen, Pairings bestaetigen.

**Hauptnutzeraktionen**:
- Geraeteliste nach Status filtern
- Neue Geraete koppeln
- Geraeteeinstellungen aendern
- Wartungsmodus aktivieren

**Layoutstruktur**:
```
+--------------------------------------------------+
| Page Header: Geraete                              |
| "Displays und Pairings" | [Aktualisieren]        |
+--------------------------------------------------+
| [3 KPIs inline] Online: 5 | Offline: 2 | Total: 7|
+--------------------------------------------------+
| [Filter Bar]                                      |
| [Search...] [Alle|Online|Offline|Wartung] [Sort]  |
+--------------------------------------------------+
| [Pending Pairings Banner] (conditional, amber)    |
| "1 Geraet wartet auf Kopplung" [Koppeln] [X]     |
+--------------------------------------------------+
| [Device Grid - 3 Spalten]                         |
| +----------+ +----------+ +----------+            |
| | Lobby    | | Eingang  | | Pool     |            |
| | Online   | | Offline  | | Online   |            |
| | Snapshot | | Snapshot | | Snapshot |            |
| | [Edit]   | | [Edit]   | | [Edit]   |            |
| +----------+ +----------+ +----------+            |
+--------------------------------------------------+
```

**Empfohlene Komponenten**: DeviceCard (vereinfacht), FilterBar (standardisiert), PendingPairingBanner, InlineKPIRow

**UX-Begruendung**: StatCards durch kompakte Inline-KPIs ersetzen (spart vertikalen Platz). Filter-Bar als einheitliches Pattern mit Search + Pill-Toggles + Sort. Pending Pairings als Banner statt eigene Section (spart Platz wenn 0).

**Strukturelle Verbesserung**: Device-Cards erhalten eine klare Status-Farbkante links (green/amber/gray). Snapshot-Thumbnail prominenter. Overflow-Menu fuer seltene Aktionen (Entkoppeln, Neustart).

---

### 3.3 Medien-Bibliothek

**Stitch-Screen**: `3449787ceae748758f28b749eedaff23`

**Zweck**: Alle Medien-Assets (Bilder, Audio, Video) zentral verwalten.

**Hauptnutzeraktionen**:
- Medien hochladen (Drag & Drop)
- Nach Typ/Tag/Name filtern
- Tags verwalten
- Medien loeschen
- Nutzung pruefen (wo wird Medium verwendet?)

**Layoutstruktur**:
```
+--------------------------------------------------+
| Page Header: Medien-Bibliothek                    |
| "Bilder, Audio und Video" | [Aktualisieren] [+]  |
+--------------------------------------------------+
| [4 KPI Cards] Gesamt: 56 | Bilder: 45 | Audio: 8 | Video: 3 |
+--------------------------------------------------+
| [Toolbar]                                         |
| [Search...] [Typ-Filter] [Tag-Filter] [Grid|List]|
+--------------------------------------------------+
| [Upload Dropzone] (expandable)                    |
| "Dateien hierher ziehen..." [Fortschrittsbalken]  |
+--------------------------------------------------+
| [Media Grid - 4 Spalten]                          |
| +------+ +------+ +------+ +------+              |
| |thumb | |thumb | |thumb | |thumb |              |
| |name  | |name  | |name  | |name  |              |
| |tags  | |tags  | |tags  | |tags  |              |
| +------+ +------+ +------+ +------+              |
+--------------------------------------------------+
| [Pagination: 1-24 von 56]                         |
+--------------------------------------------------+
```

**Empfohlene Komponenten**: MediaCard (mit Hover-Overlay), UploadDropzone, FilterToolbar, TagPill, Pagination

**UX-Begruendung**: Grid-View als Default (visuell, Bilder sind das Primaermedium). List-View als Alternative fuer Audio/grosse Bibliotheken. Upload-Dropzone ist standardmaessig zugeklappt, oeffnet sich bei Click auf "Hochladen" oder bei Drag-Over auf die Seite.

**Quick Win**: Media-Cards mit Type-Badge oben rechts (IMAGE/AUDIO/VIDEO als kleine Pill). Hover-State mit Action-Icons statt immer sichtbare Buttons.

---

### 3.4 Aufgussplan (Schedule Editor)

**Stitch-Screen**: `dad36e86d4fa4836ba4b6f73f8398f14`

**Zweck**: Tages-Aufgussprogramme fuer verschiedene Presets (Mo-So, Opt, Events) pflegen.

**Hauptnutzeraktionen**:
- Preset auswaehlen (Wochentag oder Special)
- Zeitzeilen hinzufuegen/bearbeiten
- Aufguesse in Zellen eintragen
- Auto-Play steuern
- Aenderungen speichern/verwerfen

**Layoutstruktur**:
```
+--------------------------------------------------+
| Page Header: Aufgussplan                          |
| "Presets und Zeitplaene" | [Speichern] [Reset]   |
+--------------------------------------------------+
| [Preset Tabs: Mo Di Mi Do Fr Sa So | Opt Evt1 Evt2] |
+--------------------------------------------------+
| [Draft Recovery Banner] (conditional)             |
+--------------------------------------------------+
| [Schedule Grid - Full Width]                      |
| Zeit    | Finnisch | Bio  | Dampf | Infrarot     |
| 09:00   | Birke 2F | -    | Eukal | -            |
| 09:30   | -        | Eis  | -     | Lavendel     |
| 10:00   | Honig 3F | Mint | -     | -            |
| ...                                               |
| [+ Zeitzeile hinzufuegen]                         |
+--------------------------------------------------+
| [Quality Assistant] (conditional)                 |
| [Autosave Indicator: "Entwurf gespeichert"]       |
+--------------------------------------------------+
```

**Empfohlene Komponenten**: PresetTabs, ScheduleGrid (Tabelle), CellEditor (Modal), TimeEditor (Modal), QualityAssistant, DraftRecoveryBanner, AutosaveIndicator

**UX-Begruendung**: Der Schedule-Grid ist das zentrale Werkzeug und braucht maximale Breite. Preset-Tabs als horizontale Tabs (nicht Dropdown) fuer schnellen Wechsel. Quality Assistant nur bei Problemen sichtbar. Autosave-Status dezent am unteren Rand.

**Strukturelle Verbesserung**: Die rechte Sidebar entfernen. Quality-Issues und Auto-Play-Toggle gehoeren in den Header-Bereich oder als collapsible Panel unter dem Grid.

---

### 3.5 Slideshow-Editor

**Stitch-Screen**: `4e8a46c21fdd49dfafc319166c70ef80`

**Zweck**: Slideshow-Konfiguration erstellen, bearbeiten und veroeffentlichen.

**Hauptnutzeraktionen**:
- Slides hinzufuegen/entfernen/sortieren
- Layout waehlen (Full, Triple, Split, Grid)
- Preview ansehen
- Entwurf speichern / live veroeffentlichen
- Device-Overrides konfigurieren

**Layoutstruktur**:
```
+--------------------------------------------------+
| Page Header: Slideshow-Editor                     |
| [Target: Global v] | [Save Draft] [Publish] [...] |
+--------------------------------------------------+
| [Unsaved Changes Banner] (amber, conditional)     |
| [Quality Check: Bestanden] (green, conditional)   |
+--------------------------------------------------+
| LEFT (60%)              | RIGHT (40%)             |
| [Slide List]            | [Live Preview 16:9]     |
| - Drag-sortable         |                         |
| - Slide type badges     | [Slideshow Config]      |
| - Duration, zone        | - Layout Picker         |
| - Edit/Delete on hover  | - Auto-advance          |
| [+ Slide hinzufuegen]   | - Transitions           |
|                         |                         |
|                         | [Workflow Panel]         |
|                         | - Status: Entwurf       |
|                         | - Versionshistorie      |
|                         | - Rollback-Buttons      |
+--------------------------------------------------+
```

**Empfohlene Komponenten**: SlideListItem (kompakt), LayoutPicker (visuelle Kacheln), LivePreview, WorkflowPanel, OverrideDiffView

**UX-Begruendung**: 60/40-Split behaelt die bestehende Logik bei, aber die rechte Seite wird klarer strukturiert mit Preview oben (visuell dominant) und Konfiguration darunter. Workflow als eigenes Panel statt inline.

---

### 3.6 Einstellungen (Settings)

**Stitch-Screen**: `31fc4ca6d28147ed82203b6ff97ea61c`

**Zweck**: Content-bezogene Konfiguration (Theme, Audio, Aromen, Infos, Events).

**Empfohlene Tab-Struktur** (reduziert von 7 auf 5):
```
Theme | Audio | Aromen | Infos | Events
```

Die bisherigen System-Tabs (System-Maintenance, Wartungsscreen) wandern in den neuen "Administration"-Screen.

**Layoutstruktur (Theme-Tab)**:
```
+--------------------------------------------------+
| Page Header: Einstellungen                        |
| [Speichern] [Zuruecksetzen]                      |
+--------------------------------------------------+
| [Tabs: Theme | Audio | Aromen | Infos | Events]  |
+--------------------------------------------------+
| LEFT (50%)              | RIGHT (50%)             |
| [Palette Selector]      | [Appearance Mode]       |
| - Named palettes grid   | - Light/Dark toggle     |
| - Active = brown border | [Display Style]         |
|                         | - Editorial/Modern/...  |
| [Color Token Overrides] | [Live Preview Strip]    |
| - Primary picker        | - Mini 16:9 display     |
| - Secondary picker      |   mockup                |
| - Accent picker         |                         |
+--------------------------------------------------+
| [Autosave / Draft Recovery]                       |
+--------------------------------------------------+
```

**UX-Begruendung**: Trennung von Content-Settings und System-Admin reduziert die Tab-Ueberladung. Theme-Tab als Default ist sinnvoll (meistgenutzt). Live-Preview zeigt sofortige Auswirkungen.

---

### 3.7 Benutzer & Administration (NEU: zusammengelegt)

**Stitch-Screen**: `de2b30684d5c472184db23ff406780ba`

**Zweck**: System-Administration: Benutzer, Rollen, Backups, Updates, Audit-Log, Jobs.

**Empfohlene Tab-Struktur**:
```
Benutzer | Backups | Updates | Audit-Log | System-Jobs
```

**Layoutstruktur (Benutzer-Tab)**:
```
+--------------------------------------------------+
| Page Header: Administration                       |
| [+ Neuer Benutzer]                               |
+--------------------------------------------------+
| [Tabs: Benutzer | Backups | Updates | Audit | Jobs]|
+--------------------------------------------------+
| [Search: "Benutzer suchen..."]                    |
+--------------------------------------------------+
| [User Table]                                      |
| Username | E-Mail | Rolle | Erstellt | Aktionen  |
| admin    | -      | Admin | 01.01.   | [E] [D]   |
| editor1  | e@m.de | Editor| 15.02.   | [E] [D]   |
+--------------------------------------------------+
```

**UX-Begruendung**: Bisher war die Benutzerverwaltung ein eigener Screen und System-Wartung ein Tab in Settings. Beides zusammenzufuehren als "Administration" schafft eine klare Trennung: Settings = Content-Konfiguration, Administration = System & Zugriff.

---

### 3.8 Saunen

**Stitch-Screen**: (generiert, Saunen-Verwaltung)

**Zweck**: Sauna-Stammdaten pflegen, Reihenfolge festlegen.

**Layoutstruktur**:
```
+--------------------------------------------------+
| Page Header: Saunen                               |
| "Saunadaten und Reihenfolge" | [+ Neu] [Speichern]|
+--------------------------------------------------+
| [Info Banner] "Reihenfolge per Drag & Drop"       |
+--------------------------------------------------+
| [Sortable Grid - 2 Spalten]                       |
| +---------------------+ +---------------------+  |
| | [=] Finnische Sauna | | [=] Bio-Sauna       |  |
| | Aktiv (green)       | | Aktiv (green)       |  |
| | 90 C | 20 Pers.     | | 60 C | 15 Pers.     |  |
| | [Edit] [Delete]     | | [Edit] [Delete]     |  |
| +---------------------+ +---------------------+  |
| +---------------------+ +---------------------+  |
| | [=] Dampfbad        | | [=] Infrarot        |  |
| | Wartung (amber)     | | Aktiv (green)       |  |
| +---------------------+ +---------------------+  |
+--------------------------------------------------+
```

**UX-Begruendung**: Drag & Drop Reordering ist bereits gut umgesetzt. Die Karten brauchen eine klare Farbkante links fuer die Sauna-Identitaetsfarbe. Status-Badge prominent. Edit oeffnet Dialog (bestehendes Pattern beibehalten).

---

## 4. Uebergreifende UI-Patterns (Designsystem-Empfehlungen)

### 4.1 Einheitliches Filter-Pattern

```
[Search Input] [Type Dropdown] [Status Pills] [Sort Dropdown] [View Toggle]
```
Alle filterbaren Listen (Devices, Media, Users, Audit-Log) nutzen dasselbe FilterBar-Pattern. Search ist immer links, Toggles in der Mitte, Sort/View rechts.

### 4.2 Einheitliches Table-Pattern

- Zebra-Striping: `odd:bg-white even:bg-spa-bg-primary/50`
- Sortierbare Headers mit Chevron-Indikator
- Row-Actions rechts (Icon-Buttons: Edit, Delete, More)
- Pagination-Footer: "Zeige 1-25 von 142" + Seitenwechsel
- Mobile: Card-Fallback (bereits implementiert in DataTable)

### 4.3 Einheitliches Badge/Status-Pattern

| Zustand | Farbe | Beispiel |
|---------|-------|----------|
| Online/Aktiv/OK | `bg-emerald-100 text-emerald-800` | Geraet online |
| Warning/Offline | `bg-amber-100 text-amber-800` | Geraet offline |
| Error/Fehler | `bg-red-100 text-red-800` | Verbindung fehlgeschlagen |
| Info/Neutral | `bg-blue-100 text-blue-800` | 5 Geraete total |
| Muted/Inaktiv | `bg-gray-100 text-gray-600` | Geschlossen |

### 4.4 Einheitliches Dialog-Pattern

- **Size**: `sm` (400px) fuer Confirmations, `md` (560px) fuer Forms, `lg` (720px) fuer komplexe Editoren
- **Structure**: Header (Title + Close-X) | Body (scrollable) | Footer (Cancel left, Primary Action right)
- **Destructive Actions**: ConfirmDialog mit rotem Button und Warnung

### 4.5 Einheitliches Page-Layout

```
<Layout>
  <PageHeader title="..." actions={...} />
  <KPIRow metrics={[...]} />           {/* Optional */}
  <FilterBar filters={...} />          {/* Optional */}
  <ContentArea>                        {/* Main content */}
    {children}
  </ContentArea>
  <StatusFooter />                     {/* Optional: Autosave, Quality */}
</Layout>
```

### 4.6 Einheitlicher Card-Typ

Konsolidierung auf 3 Card-Typen:
1. **Surface Card**: Weisser Hintergrund, subtle Border. Fuer Content-Container (SectionCard).
2. **Metric Card**: Kompakter KPI mit Icon, Wert, Label. Fuer Stats (StatCard vereinfacht).
3. **Interactive Card**: Surface + Hover-State + Click-Handler. Fuer Device-Cards, Media-Cards, Sauna-Cards.

---

## 5. Quick Wins vs. Strukturelle Verbesserungen

### Quick Wins (1-2 Tage je)

| # | Aenderung | Impact | Aufwand |
|---|-----------|--------|---------|
| Q1 | Gradient-Background durch flaches `bg-spa-bg-primary` ersetzen | Professioneller Gesamteindruck | 5 Min |
| Q2 | PageHeader-Badges reduzieren (max 2 pro Screen) | Bessere Scanbarkeit | 30 Min |
| Q3 | StatCard aus `/Dashboard/` nach `/components/` verschieben | Saubere Struktur | 15 Min |
| Q4 | Breadcrumbs entfernen (nur 1 Nav-Ebene) | Weniger Clutter | 10 Min |
| Q5 | Sidebar: Beschreibungstexte auf Desktop entfernen | Kompaktere Navigation | 10 Min |
| Q6 | Sidebar: Active-Dot entfernen, nur Background reicht | Klarerer Active-State | 5 Min |
| Q7 | Einheitliches Spacing: `gap-6` und `space-y-6` als Standard | Konsistenz | 1h |

### Strukturelle Verbesserungen (1-2 Sprints je)

| # | Aenderung | Impact | Aufwand |
|---|-----------|--------|---------|
| S1 | FilterBar als wiederverwendbare Komponente | Konsistenz ueber alle Listen | 1 Sprint |
| S2 | Settings aufteilen in "Einstellungen" + "Administration" | Klarere IA | 1 Sprint |
| S3 | Dashboard-Widgets konsolidieren (feste Anordnung, kein Konfigurator) | Einfacherer, fokussierterer Dashboard | 1 Sprint |
| S4 | Einheitliches Edit-Pattern (Dialog-basiert fuer alle CRUD) | Konsistente UX | 2 Sprints |
| S5 | Farbsystem konsolidieren (nur `spa-*` Tokens, theme.constants.ts entfernen) | Einfachere Wartung | 1 Sprint |

---

## 6. Empfohlene Umsetzungsreihenfolge

### Phase 1: Foundation (Quick Wins)
> Sofort umsetzbar, kein Risiko, grosser visueller Impact

1. Q1: Gradient-Background entfernen
2. Q5 + Q6: Sidebar aufraeumen
3. Q4: Breadcrumbs entfernen
4. Q7: Spacing vereinheitlichen
5. Q2: PageHeader-Badges reduzieren
6. Q3: StatCard verschieben

### Phase 2: Dashboard Redesign
> Einstiegsseite als Visitenkarte

1. S3: Dashboard-Widgets konsolidieren
2. Dashboard-Layout gemaess Stitch-Entwurf umbauen
3. KPI-Row als kompaktes Inline-Pattern

### Phase 3: Filter & Tables
> Konsistenz ueber alle datenlastigen Screens

1. S1: FilterBar-Komponente erstellen
2. FilterBar in Devices, Media, Users einbauen
3. DataTable-Styling vereinheitlichen

### Phase 4: Settings & Administration
> Informationsarchitektur bereinigen

1. S2: Settings aufteilen
2. Administration-Screen erstellen
3. Tab-Struktur reduzieren

### Phase 5: Detail-Screens
> Content-Editoren verfeinern

1. Schedule-Editor: Quality-Sidebar zu collapsible Panel
2. Slideshow-Editor: Preview prominenter, Workflow-Panel klarer
3. Saunen: Farbkante und Status-Badge verbessern

### Phase 6: Design System Konsolidierung
> Technische Schulden abbauen

1. S5: Dual-Farbsystem aufloesen
2. Card-Typen konsolidieren
3. Error-Handling vereinheitlichen (Toast als primaerer Channel)

---

## 7. Stitch-Projekt-Referenz

Alle Screen-Entwuerfe sind im Stitch-Projekt `9411312541944602204` verfuegbar:

| Screen | Stitch-ID | Titel |
|--------|-----------|-------|
| Dashboard (Variante 1) | `abfd972e33654b7685dcbd10caeaa5dd` | HTMLSignage Admin Dashboard |
| Dashboard (Variante 2) | `7c1acd30448a41df81c8dc49bebe89ea` | Dashboard Overview |
| Geraete | `e1666c7af0214bb195bfd72d222adb0b` | Geraete Management |
| Medien | `3449787ceae748758f28b749eedaff23` | HTMLSignage Medien-Bibliothek |
| Aufgussplan | `dad36e86d4fa4836ba4b6f73f8398f14` | Aufgussplan Editor |
| Slideshow | `4e8a46c21fdd49dfafc319166c70ef80` | Slideshow Editor |
| Einstellungen | `31fc4ca6d28147ed82203b6ff97ea61c` | System-Einstellungen |
| Benutzer | `de2b30684d5c472184db23ff406780ba` | Benutzer & Rollen |
| Saunen | `aac984212c9c44da9e7741a3045f202d` | Sauna Management Overview |
| Saunen Edit-Dialog | `eca7f6879ad14d9fb129064ba61f2287` | Edit Sauna Dialog |

**Insgesamt: 10 Screen-Entwuerfe**

**Design System**: `assets/18400072296702127310` (HTMLSignage Admin DS)

Um die Entwuerfe visuell zu sehen, oeffne das Stitch-Projekt unter:
`https://stitch.withgoogle.com/projects/9411312541944602204`

---

## 8. Naechste Schritte

1. **Review der Stitch-Entwuerfe** - Alle 8+ Screens im Stitch-Projekt visuell pruefen
2. **Feedback-Runde** - Welche Screens entsprechen der Vision, welche brauchen Varianten?
3. **Phase 1 starten** - Quick Wins umsetzen (kann sofort beginnen)
4. **Pro Screen umsetzen** - Jeweils einen Screen nach Stitch-Vorlage implementieren
