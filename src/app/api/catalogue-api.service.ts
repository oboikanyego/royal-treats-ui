import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { CatalogueProduct, Settings } from '../commerce-state.service';
import { ApiClient } from './api-client.service';
import { fromApiProduct, fromApiSettings } from './api-mappers';
import type { ApiProduct, ApiSettings, Paginated } from './api-types';

const PAGE_SIZE = 100; // the API's maximum

/** Public, read-only catalogue endpoints. */
@Injectable({ providedIn: 'root' })
export class CatalogueApi {
  private readonly api = inject(ApiClient);

  /** Every product, following pagination. */
  async products(): Promise<CatalogueProduct[]> {
    const items: ApiProduct[] = [];
    for (let page = 1; ; page++) {
      const result = await firstValueFrom(
        this.api.get<Paginated<ApiProduct>>('/products', { page, limit: PAGE_SIZE }),
      );
      items.push(...result.items);
      if (!result.items.length || items.length >= result.total) break;
    }
    return items.map(fromApiProduct);
  }

  async settings(defaults: Settings): Promise<Settings> {
    return fromApiSettings(await firstValueFrom(this.api.get<ApiSettings>('/settings')), defaults);
  }
}
