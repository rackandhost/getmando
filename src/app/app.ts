import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { SettingsService } from './core/services/settings.service';
import { ThemeService } from './core/services/theme.service';
import { AppShellComponent } from './shared/components/app-shell/app-shell.component';
import { AppToastComponent } from './shared/components/app-toast/app-toast.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppShellComponent, AppToastComponent],
  templateUrl: 'app.html',
  styleUrl: 'app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly settingsService = inject(SettingsService);
  private readonly themeService = inject(ThemeService);

  constructor() {
    effect(() => {
      const { lightBackgroundImage, darkBackgroundImage } = this.settingsService.settings();
      this.themeService.currentTheme();
      this.setBackgroundImage({ lightBackgroundImage, darkBackgroundImage });
    });
  }

  private setBackgroundImage({
    lightBackgroundImage,
    darkBackgroundImage,
  }: {
    lightBackgroundImage: string;
    darkBackgroundImage: string;
  }): void {
    const bgLayer = document.getElementById('app-background');
    if (!bgLayer) return;

    const selectedImage = this.themeService.isDarkMode()
      ? darkBackgroundImage
      : lightBackgroundImage;
    const isImageAnUrl = selectedImage.startsWith('https') || selectedImage.startsWith('http');

    bgLayer.style.backgroundImage = `url(${isImageAnUrl ? '' : '/img/'}${selectedImage})`;
  }
}
