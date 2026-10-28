import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi } from '../api/admin-api.service';
import { adminErrorMessage } from '../api/admin-messages';
import {
  optionListText,
  productImageProblem,
  productProblem,
  toAvailabilityPayload,
  toProductPayload,
} from '../api/admin-payloads';
import { toApiError } from '../api/api-errors';
import { CATEGORY_OPTIONS, isDeliverableCategory } from '../catalogue-config';
import { CatalogueProduct, CommerceState } from '../commerce-state.service';
import { RandPipe } from '../rand.pipe';
import { ImageSrcPipe } from '../image.pipes';

const CATEGORIES = Object.keys(CATEGORY_OPTIONS);

/** Catalogue management. Product photos are uploaded as files; there is no image-URL field. */
@Component({
  selector: 'rt-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule, RandPipe, ImageSrcPipe],
  templateUrl: './admin-products.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class AdminProductsComponent {
  readonly store = inject(CommerceState);
  private readonly admin = inject(AdminApi);

  readonly notice = signal('');
  readonly error = signal('');
  /** The product being edited (a copy) and whether it is not saved yet. */
  readonly edited = signal<CatalogueProduct | null>(null);
  readonly isNew = signal(false);
  readonly imageError = signal('');
  readonly uploading = signal(false);
  readonly saving = signal(false);
  readonly editorError = signal('');
  readonly pendingAvailability = signal<CatalogueProduct | null>(null);
  optionText = { flavours: '', toppings: '' };

  readonly categories = computed(() => {
    const current = this.edited()?.category;
    return current && !CATEGORIES.includes(current) ? [...CATEGORIES, current] : CATEGORIES;
  });

  canBeDelivered(p: CatalogueProduct) {
    return isDeliverableCategory(p.category);
  }

  edit(product?: CatalogueProduct) {
    this.notice.set('');
    this.error.set('');
    this.editorError.set('');
    this.imageError.set('');
    this.isNew.set(!product);
    const copy: CatalogueProduct = product
      ? JSON.parse(JSON.stringify(product))
      : {
          id: '',
          name: '',
          category: 'Mini Donuts',
          price: 0,
          image: '',
          description: '',
          available: true,
          deliverable: true,
          variants: [{ label: 'Standard', price: 0 }],
        };
    this.optionText = {
      flavours: optionListText(product?.options?.flavours),
      toppings: optionListText(product?.options?.toppings),
    };
    this.edited.set(copy);
  }

  addVariant() {
    this.edited()?.variants.push({ label: '', price: 0 });
  }
  removeVariant(i: number) {
    const p = this.edited();
    if (p && p.variants.length > 1) p.variants.splice(i, 1);
  }

  closeEditor() {
    if (this.saving() || this.uploading()) return;
    this.edited.set(null);
  }

  @HostListener('document:keydown.escape')
  handleEscape() {
    this.closeEditor();
    this.pendingAvailability.set(null);
  }

  /** Uploads the chosen picture to the API straight away; the product then holds the stored URL. */
  async upload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const p = this.edited();
    input.value = '';
    if (!file || !p) return;
    this.imageError.set('');
    const problem = productImageProblem(file);
    if (problem) {
      this.imageError.set(problem);
      return;
    }
    this.uploading.set(true);
    try {
      p.image = (await this.admin.uploadImage(file)).url;
    } catch (failure) {
      this.imageError.set(adminErrorMessage(toApiError(failure), 'image'));
    } finally {
      this.uploading.set(false);
    }
  }

  removeImage() {
    const p = this.edited();
    if (p) p.image = '';
  }

  async save() {
    const p = this.edited();
    if (!p || this.saving() || this.uploading()) return;
    const problem = productProblem(p, this.optionText);
    if (problem) {
      this.editorError.set(problem);
      return;
    }
    this.saving.set(true);
    this.editorError.set('');
    try {
      const payload = toProductPayload(p, this.optionText);
      const saved = this.isNew()
        ? await this.admin.createProduct(payload)
        : await this.admin.updateProduct(p.id, payload);
      this.store.applyProduct(saved);
      this.notice.set(this.isNew() ? `${saved.name} was added.` : `${saved.name} was saved.`);
      this.edited.set(null);
    } catch (failure) {
      this.editorError.set(adminErrorMessage(toApiError(failure), 'products'));
    } finally {
      this.saving.set(false);
    }
  }

  async confirmAvailability() {
    const product = this.pendingAvailability();
    if (!product) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const saved = await this.admin.updateProduct(
        product.id,
        toAvailabilityPayload(product, !product.available),
      );
      this.store.applyProduct(saved);
      this.notice.set(
        saved.available
          ? `${saved.name} is available again.`
          : `${saved.name} is now out of stock.`,
      );
    } catch (failure) {
      this.error.set(adminErrorMessage(toApiError(failure), 'products'));
    } finally {
      this.saving.set(false);
      this.pendingAvailability.set(null);
    }
  }
}
