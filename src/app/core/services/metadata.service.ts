import {inject, Injectable} from '@angular/core';
import {map} from 'rxjs';

import {ConfigService} from './config.service';

@Injectable({ providedIn: 'root' })
export class MetadataService {
  private configService = inject(ConfigService);

  readonly metadata$ = this.configService.config$.pipe(map((config) => config.metadata));
}
