import {inject, Injectable} from '@angular/core';
import {map} from 'rxjs/operators';
import {toSignal} from '@angular/core/rxjs-interop';

import {ConfigService} from './config.service';

@Injectable({ providedIn: 'root' })
export class BookmarkService {
  private configService = inject(ConfigService);

  readonly bookmarks$= this.configService.config$.pipe(map((config) => config.bookmarks));

  get bookmarks() {
    return this.configService.subject.value?.bookmarks || [];
  }
}
