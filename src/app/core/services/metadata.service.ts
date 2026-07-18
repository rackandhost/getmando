import { computed, inject, Injectable } from '@angular/core';

import { ConfigService } from './config.service';

@Injectable({ providedIn: 'root' })
export class MetadataService {
  private configService = inject(ConfigService);

  readonly metadata = computed(() => this.configService.config()?.metadata);
}
