import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { AdminLive } from './api/admin-live.service';

/** "<page title> | Royal Treats", using each route's `title`. */
@Injectable({ providedIn: 'root' })
export class RoyalTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly live = inject(AdminLive);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const page = this.buildTitle(snapshot);
    this.title.setTitle(this.live.withCount(page ? `${page} | Royal Treats` : 'Royal Treats'));
  }
}
