import {
  Activity,
  Download,
  Image as ImageIcon,
  Monitor,
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
  if (action.startsWith('schedule.') || action.startsWith('settings.') || action.startsWith('slideshow.')) {
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

export function summarizeAuditDetails(details: AuditLogItem['details']): string[] {
  if (!details) return [];

  return Object.entries(details)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 4)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: ${value.join(', ')}`;
      }
      if (typeof value === 'object') {
        return `${key}: …`;
      }
      return `${key}: ${String(value)}`;
    });
}
