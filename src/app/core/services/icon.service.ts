import {Injectable} from '@angular/core';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';

import {SelfhostedApp} from '../models/dashboard.models';

/**
 * Icon type options
 */
export type IconType = 'url' | 'name' | 'initials';

/**
 * Icon configuration
 */
export interface IconConfig {
  type: IconType;
  value: string;
}

/**
 * Service for handling application icons
 * Supports CDN icons, custom URLs, and generated SVG fallbacks
 */
@Injectable({ providedIn: 'root' })
export class IconService {
  private readonly sanitizer: DomSanitizer;

  // CDN base URLs
  private readonly DASHBOARD_ICONS_CDN =
    'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png';
  private readonly GOOGLE_ICONS_CDN = 'https://www.google.com/s2/favicons';
  private readonly MATERIAL_ICONS_CDN = 'https://fonts.gstatic.com/s/i/materialicons';

  // Icon cache
  private readonly iconCache = new Map<string, string>();

  constructor(sanitizer: DomSanitizer) {
    this.sanitizer = sanitizer;
  }

  /**
   * Get icon URL for an application
   * @param app - Selfhosted application
   * @returns Icon URL string
   */
  getIconUrl(app: SelfhostedApp): string {
    return this.getIconUrlFromConfig(app.icon, app.name);
  }

  /**
   * Get icon URL from configuration
   * @param iconConfig - Icon configuration
   * @param appName - Application name (for fallback)
   * @returns Icon URL string
   */
  getIconUrlFromConfig(iconConfig: IconConfig, appName: string): string {
    const cacheKey = `${iconConfig.type}-${iconConfig.value}`;

    // Check cache
    if (this.iconCache.has(cacheKey)) {
      return this.iconCache.get(cacheKey)!;
    }

    let url: string;

    switch (iconConfig.type) {
      case 'url':
        url = iconConfig.value;
        break;
      case 'name':
        url = this.getIconFromCDN(iconConfig.value);
        break;
      case 'initials':
        url = this.generateInitialsIcon(appName, iconConfig.value);
        break;
      default:
        url = this.generateInitialsIcon(appName);
    }

    // Cache and return
    this.iconCache.set(cacheKey, url);
    return url;
  }

  /**
   * Get icon as SafeUrl for Angular binding
   * @param app - Selfhosted application
   * @returns SafeUrl
   */
  getIconUrlSafe(app: SelfhostedApp): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl(this.getIconUrl(app));
  }

  /**
   * Get icon from CDN by name
   * @param name - Icon/service name
   * @returns CDN URL
   */
  private getIconFromCDN(name: string): string {
    const sanitizedName = name.toLowerCase().replace(/\s+/g, '-');

    // Try Dashboard Icons CDN first
    return `${this.DASHBOARD_ICONS_CDN}/${sanitizedName}.png`;
  }

  /**
   * Fallback to Google Favicon
   * @param url - Application URL
   * @returns Google Favicon URL
   */
  getGoogleFavicon(url: string): string {
    try {
      const domain = new URL(url).hostname;
      return `${this.GOOGLE_ICONS_CDN}?domain=${domain}&sz=128`;
    } catch {
      return this.generateDefaultIcon();
    }
  }

  /**
   * Generate SVG icon with initials
   * @param name - Application name
   * @param initials - Custom initials (optional)
   * @returns Data URL of SVG icon
   */
  private generateInitialsIcon(name: string, initials?: string): string {
    const displayInitials = initials || this.extractInitials(name);
    const backgroundColor = this.getColorFromString(name);

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
        <rect width="128" height="128" fill="${backgroundColor}" rx="24"/>
        <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="48" font-weight="bold"
              fill="white" text-anchor="middle" dominant-baseline="middle">
          ${displayInitials}
        </text>
      </svg>
    `;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  /**
   * Generate default icon
   * @returns Data URL of default SVG icon
   */
  private generateDefaultIcon(): string {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
        <rect width="128" height="128" fill="#6366f1" rx="24"/>
        <path d="M64 32c-17.673 0-32 14.327-32 32s14.327 32 32 32 32-14.327 32-32-14.327-32-32-32zm0 56c-13.255 0-24-10.745-24-24s10.745-24 24-24 24 10.745 24 24-10.745 24-24 24z" fill="white"/>
        <circle cx="64" cy="64" r="8" fill="white"/>
      </svg>
    `;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  /**
   * Extract initials from name
   * @param name - Application name
   * @returns Initials (max 2 characters)
   */
  private extractInitials(name: string): string {
    const words = name.trim().split(/\s+/);

    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }

    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  /**
   * Generate consistent color from string
   * @param str - Input string
   * @returns HSL color string
   */
  private getColorFromString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    const h = Math.abs(hash % 360);
    const s = 70;
    const l = 55;

    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  /**
   * Clear icon cache
   */
  clearCache(): void {
    this.iconCache.clear();
  }

  /**
   * Preload icon
   * @param url - Icon URL to preload
   * @returns Promise that resolves when image is loaded
   */
  preloadIcon(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load icon: ${url}`));
      img.src = url;
    });
  }

  /**
   * Get icon as HTMLImageElement
   * @param app - Selfhosted application
   * @returns Promise<HTMLImageElement>
   */
  async getIconElement(app: SelfhostedApp): Promise<HTMLImageElement> {
    const url = this.getIconUrl(app);
    await this.preloadIcon(url);

    const img = document.createElement('img');
    img.src = url;
    img.alt = app.name;
    return img;
  }
}
