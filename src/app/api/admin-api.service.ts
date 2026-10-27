import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { CatalogueProduct, Settings } from '../commerce-state.service';
import { ApiClient } from './api-client.service';
import { fromApiProduct, fromApiSettings } from './api-mappers';
import type {
  ApiDashboard,
  ApiImage,
  ApiProduct,
  ApiSettings,
  ApiUser,
  CourierRequest,
  Paginated,
  ProductPayload,
  SettingsPayload,
} from './api-types';

/** Admin-only endpoints of royal-treats-api. Every call needs the signed-in admin's bearer token. */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly api = inject(ApiClient);

  dashboard(): Promise<ApiDashboard> {
    return firstValueFrom(this.api.get<ApiDashboard>('/admin/dashboard'));
  }

  async createProduct(payload: ProductPayload): Promise<CatalogueProduct> {
    return fromApiProduct(
      await firstValueFrom(this.api.post<ApiProduct>('/admin/products', payload)),
    );
  }
  async updateProduct(id: string, payload: ProductPayload): Promise<CatalogueProduct> {
    return fromApiProduct(
      await firstValueFrom(
        this.api.put<ApiProduct>(`/admin/products/${encodeURIComponent(id)}`, payload),
      ),
    );
  }
  /** Product photos are uploaded as files only; the API re-encodes them and returns the stored URL. */
  uploadImage(file: File): Promise<ApiImage> {
    const form = new FormData();
    form.set('image', file); // the API reads the multipart field named `image`
    return firstValueFrom(this.api.post<ApiImage>('/admin/images', form));
  }

  async saveSettings(payload: SettingsPayload, current: Settings): Promise<Settings> {
    return fromApiSettings(
      await firstValueFrom(this.api.put<ApiSettings>('/admin/settings', payload)),
      current,
    );
  }

  couriers(page: number, limit: number): Promise<Paginated<ApiUser>> {
    return firstValueFrom(this.api.get<Paginated<ApiUser>>('/admin/couriers', { page, limit }));
  }
  createCourier(request: CourierRequest): Promise<ApiUser> {
    return firstValueFrom(this.api.post<ApiUser>('/admin/couriers', request));
  }
  setCourierActive(id: string, active: boolean): Promise<ApiUser> {
    return firstValueFrom(
      this.api.patch<ApiUser>(`/admin/couriers/${encodeURIComponent(id)}`, { active }),
    );
  }
}
