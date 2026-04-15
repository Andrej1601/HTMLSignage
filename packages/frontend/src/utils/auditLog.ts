import {
  Activity,
  Download,
  Image as ImageIcon,
  Monitor,
  Presentation,
  Settings2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { AuditLogItem } from '@/services/api';
import type { ActivityCategory } from '@/components/Dashboard/ActivityFeedWidget';
import type { StatusTone } from '@/components/StatusBadge';

export function formatAuditActionLabel(action: string): string {
  const labels: Record<string, string> = {
    'schedule.update': 'Aufgussplan gespeichert',
    'settings.update': 'Einstellungen gespeichert',
    'device.create': 'Gerät angelegt',
    'device.update': 'Gerät geändert',
    'device.delete': 'Gerät gelöscht',
    'device.pair': 'Gerät gekoppelt',
    'device.command': 'Gerätebefehl gesendet',
    'device.override.update': 'Override gespeichert',
    'device.override.clear': 'Override gelöscht',
    'media.upload': 'Medium hochgeladen',
    'media.tags.update': 'Medien-Tags geändert',
    'media.delete': 'Medium gelöscht',
    'user.create': 'Benutzer angelegt',
    'user.update': 'Benutzer geändert',
    'user.delete': 'Benutzer gelöscht',
    'system.backup.export': 'Backup exportiert',
    'system.backup.preview': 'Backup geprüft',
    'system.backup.import': 'Backup importiert',
    'system.update.run': 'Systemupdate ausgeführt',
    'system.update.failed': 'Systemupdate fehlgeschlagen',
    'slideshow.draft.save': 'Slideshow-Entwurf gespeichert',
    'slideshow.draft.discard': 'Slideshow-Entwurf verworfen',
    'slideshow.publish': 'Slideshow veröffentlicht',
    'slideshow.rollback': 'Slideshow wiederhergestellt',
  };

  return labels[action] || action;
}

export function getAuditActionMeta(action: string): {
  tone: StatusTone;
  icon: LucideIcon;
  group: string;
  category: ActivityCategory;
} {
  if (action.startsWith('slideshow.')) {
    return { tone: 'info', icon: Presentation, group: 'Slideshows', category: 'media' };
  }
  if (action.startsWith('schedule.')) {
    return { tone: 'success', icon: Settings2, group: 'Aufgussplan', category: 'einstellungen' };
  }
  if (action.startsWith('settings.')) {
    return { tone: 'success', icon: Settings2, group: 'Einstellungen', category: 'einstellungen' };
  }
  if (action.startsWith('device.')) {
    return { tone: 'info', icon: Monitor, group: 'Geräte', category: 'device' };
  }
  if (action.startsWith('media.')) {
    return { tone: 'info', icon: ImageIcon, group: 'Inhalte', category: 'media' };
  }
  if (action.startsWith('user.')) {
    return { tone: 'warning', icon: Users, group: 'Benutzer', category: 'benutzer' };
  }
  if (action.startsWith('system.')) {
    return { tone: 'warning', icon: Download, group: 'Systemjobs', category: 'systemjobs' };
  }
  return { tone: 'neutral', icon: Activity, group: 'Systemjobs', category: 'systemjobs' };
}

/** Maps raw detail keys to human-readable German labels. */
const DETAIL_KEY_LABELS: Record<string, string> = {
  // Media
  filename: 'Dateiname',
  originalName: 'Originaldatei',
  type: 'Typ',
  size: 'Dateigröße',
  tags: 'Tags',
  mimeType: 'Dateityp',
  // Device
  name: 'Name',
  deviceName: 'Gerätename',
  browserId: 'Browser-ID',
  pairingCode: 'Pairing-Code',
  command: 'Befehl',
  action: 'Aktion',
  mode: 'Modus',
  maintenanceMode: 'Wartungsmodus',
  groupName: 'Gruppe',
  slideshowId: 'Slideshow',
  // Schedule/Settings
  version: 'Version',
  presetKey: 'Tagesplan',
  // User
  username: 'Benutzername',
  email: 'E-Mail',
  roles: 'Rollen',
  // System
  targetVersion: 'Zielversion',
  currentVersion: 'Aktuelle Version',
  error: 'Fehler',
  backupFile: 'Backup-Datei',
};

/** Maps raw detail values to human-readable German text. */
function humanizeValue(key: string, value: unknown): string {
  if (value === true) return 'Ja';
  if (value === false) return 'Nein';

  if (key === 'size' && typeof value === 'number') {
    if (value > 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    if (value > 1024) return `${(value / 1024).toFixed(0)} KB`;
    return `${value} Bytes`;
  }

  if (key === 'type' && typeof value === 'string') {
    const types: Record<string, string> = { image: 'Bild', audio: 'Audio', video: 'Video', other: 'Sonstige' };
    return types[value] || value;
  }

  if (key === 'mode' && typeof value === 'string') {
    const modes: Record<string, string> = { auto: 'Automatisch', override: 'Manuell (Override)' };
    return modes[value] || value;
  }

  if (key === 'command' && typeof value === 'string') {
    const commands: Record<string, string> = {
      reload: 'Neu laden', restart: 'Neustart', 'clear-cache': 'Cache leeren',
      reconnect: 'Neu verbinden',
    };
    return commands[value] || value;
  }

  if (key === 'roles' && Array.isArray(value)) {
    const roleLabels: Record<string, string> = { admin: 'Administrator', editor: 'Editor', viewer: 'Betrachter' };
    return value.map((r) => roleLabels[String(r)] || String(r)).join(', ');
  }

  if (Array.isArray(value)) {
    return value.map(String).join(', ');
  }

  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value).slice(0, 3);
    if (entries.length === 0) return '–';
    return entries.map(([k, v]) => `${DETAIL_KEY_LABELS[k] || k}: ${String(v)}`).join(', ');
  }

  return String(value);
}

/** Hidden keys that add no value to the user. */
const HIDDEN_KEYS = new Set(['id', 'userId', 'updatedAt', 'createdAt', 'tokenHash', 'ipAddress', 'userAgent']);

export function summarizeAuditDetails(details: AuditLogItem['details']): string[] {
  if (!details) return [];

  return Object.entries(details)
    .filter(([key, value]) => value !== null && value !== undefined && value !== '' && !HIDDEN_KEYS.has(key))
    .slice(0, 5)
    .map(([key, value]) => {
      const label = DETAIL_KEY_LABELS[key] || key;
      return `${label}: ${humanizeValue(key, value)}`;
    });
}

/** Generates a human-readable description for an audit log entry. */
export function formatAuditDescription(action: string, resource: string | null | undefined, details: AuditLogItem['details']): string {
  const d = details || {};

  // Media actions — show filename
  if (action === 'media.upload' && d.originalName) {
    return `"${d.originalName}" (${humanizeValue('type', d.type)})`;
  }
  if (action === 'media.delete' && d.filename) {
    return `"${d.originalName || d.filename}"`;
  }
  if (action === 'media.tags.update' && d.tags) {
    return `Tags: ${Array.isArray(d.tags) ? d.tags.join(', ') : String(d.tags)}`;
  }

  // Device actions — show device name
  if (action === 'device.pair' && d.name) return `"${d.name}" gekoppelt`;
  if (action === 'device.create' && d.name) return `"${d.name}" angelegt`;
  if (action === 'device.delete' && d.name) return `"${d.name}" entfernt`;
  if (action === 'device.update' && d.name) return `"${d.name}" aktualisiert`;
  if (action === 'device.command' && d.command) return `Befehl: ${humanizeValue('command', d.command)}`;

  // User actions
  if (action === 'user.create' && d.username) return `"${d.username}" angelegt`;
  if (action === 'user.update' && d.username) return `"${d.username}" geändert`;
  if (action === 'user.delete' && d.username) return `"${d.username}" gelöscht`;

  // Schedule/Settings — show version
  if (action === 'schedule.update' && d.version) return `Version ${d.version} gespeichert`;
  if (action === 'settings.update' && d.version) return `Version ${d.version} gespeichert`;

  // System
  if (action === 'system.backup.export') return 'Vollständiges Backup erstellt';
  if (action === 'system.backup.import') return 'Backup wiederhergestellt';
  if (action === 'system.update.run' && d.targetVersion) return `Update auf ${d.targetVersion}`;
  if (action === 'system.update.failed' && d.error) return `Fehler: ${String(d.error).slice(0, 80)}`;

  // Slideshow
  if (action.startsWith('slideshow.') && d.name) return `"${d.name}"`;

  // Fallback
  if (resource) return resource;
  return getAuditActionMeta(action).group;
}
