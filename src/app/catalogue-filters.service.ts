import { Injectable, computed, inject, signal } from '@angular/core';
import { CommerceState } from './commerce-state.service';

/**
 * Menu search, category, sort and paging. Kept in a service so the shopper's place in the
 * menu survives a visit to a product page and back.
 */
@Injectable({ providedIn: 'root' })
export class CatalogueFilters {
  private readonly store = inject(CommerceState);
  readonly pageSize = 8;

  readonly category = signal('All');
  readonly searchText = signal('');
  readonly sortBy = signal('featured');
  readonly availableOnly = signal(false);
  readonly page = signal(1);

  readonly categories = computed(() => [
    'All',
    ...new Set(this.store.products().map((x) => x.category)),
  ]);
  readonly filtered = computed(() => {
    const needle = this.searchText().trim().toLowerCase();
    let items = this.store
      .products()
      .filter(
        (p) =>
          (this.category() === 'All' || p.category === this.category()) &&
          (!this.availableOnly() || p.available) &&
          [p.name, p.category, p.description].some((value) => value.toLowerCase().includes(needle)),
      );
    if (this.sortBy() === 'price-low') items = [...items].sort((a, b) => a.price - b.price);
    if (this.sortBy() === 'price-high') items = [...items].sort((a, b) => b.price - a.price);
    if (this.sortBy() === 'name') items = [...items].sort((a, b) => a.name.localeCompare(b.name));
    return items;
  });
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize)),
  );
  readonly visibleProducts = computed(() =>
    this.filtered().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize),
  );
  /** A window of at most five page buttons around the current page. */
  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const count = Math.min(5, total);
    const start = Math.max(1, Math.min(this.page() - 2, total - count + 1));
    return Array.from({ length: count }, (_, index) => start + index);
  });

  setSearch(value: string) {
    this.searchText.set(value);
    this.page.set(1);
  }
  setCategory(value: string) {
    this.category.set(value);
    this.page.set(1);
  }
  setSort(value: string) {
    this.sortBy.set(value);
    this.page.set(1);
  }
  setAvailableOnly(value: boolean) {
    this.availableOnly.set(value);
    this.page.set(1);
  }
  setPage(n: number) {
    this.page.set(Math.max(1, Math.min(this.totalPages(), n)));
    window.scrollTo(0, 220);
  }
  clear() {
    this.searchText.set('');
    this.category.set('All');
    this.sortBy.set('featured');
    this.availableOnly.set(false);
    this.page.set(1);
  }
}
