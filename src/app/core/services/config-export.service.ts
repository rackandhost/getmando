import { Injectable, inject } from '@angular/core';

import { LoggerService } from './logger.service';
import { NotificationService } from './notification.service';

/** Encapsulates browser-only YAML export effects. */
@Injectable({ providedIn: 'root' })
export class ConfigExportService {
  private readonly logger = inject(LoggerService);
  private readonly notifications = inject(NotificationService);

  async copy(content: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(content);
      this.notifications.success('YAML copied to the clipboard.');
      return true;
    } catch (error) {
      this.logger.error('[ConfigExport] Failed to copy YAML:', error);
      this.notifications.error('Unable to copy YAML. Check clipboard permissions.');
      return false;
    }
  }

  download(content: string): boolean {
    try {
      const blob = new Blob([content], { type: 'application/yaml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'dashboard.yaml';
      anchor.click();
      URL.revokeObjectURL(url);
      this.notifications.success('YAML downloaded as dashboard.yaml.');
      return true;
    } catch (error) {
      this.logger.error('[ConfigExport] Failed to download YAML:', error);
      this.notifications.error('Unable to download YAML. Try again.');
      return false;
    }
  }
}
