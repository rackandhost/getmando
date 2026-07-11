import { inject, Injectable } from '@angular/core';
import { computed } from '@angular/core';

import { ConfigService } from './config.service';

@Injectable({ providedIn: 'root' })
export class BookmarkService {
  private configService = inject(ConfigService);

  readonly bookmarks = computed(() => this.configService.config()?.bookmarks ?? []);
}
