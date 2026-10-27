import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';

/**
 * Downloads the code of routes marked `data: { preload: true }` in the background once the first
 * page is up, so tapping a product, the basket or checkout does not wait for a download. The
 * staff workspace is not marked: customers never need it.
 */
@Injectable({ providedIn: 'root' })
export class PreloadMarked implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    return route.data?.['preload'] ? load() : of(null);
  }
}
