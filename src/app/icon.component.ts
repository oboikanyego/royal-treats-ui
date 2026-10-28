import { CommonModule } from '@angular/common';
import { Component, ViewEncapsulation, input } from '@angular/core';

export type IconName =
  | 'home'
  | 'menu'
  | 'orders'
  | 'cart'
  | 'about'
  | 'mail'
  | 'user'
  | 'workspace'
  | 'close'
  | 'chevron'
  | 'logout'
  | 'menu-lines';

/** Simple line icons, drawn the same way on every phone (emoji and symbols differ on iOS and Android). */
@Component({
  selector: 'rt-icon',
  standalone: true,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None,
  template: `<svg
    class="rt-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.9"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    [ngSwitch]="name()"
  >
    <ng-container *ngSwitchCase="'home'">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h5v-6h4v6h5V9.5" />
    </ng-container>
    <ng-container *ngSwitchCase="'menu'">
      <path d="M5 9h14l-1.4 10.2a1.5 1.5 0 0 1-1.5 1.3H7.9a1.5 1.5 0 0 1-1.5-1.3L5 9Z" />
      <path d="M3.5 9h17" />
      <path d="M9 9c0-3 1.6-5 3-5s3 2 3 5" />
    </ng-container>
    <ng-container *ngSwitchCase="'orders'">
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
    </ng-container>
    <ng-container *ngSwitchCase="'cart'">
      <path d="M3 4h2.2l2 11h10.2l1.9-8H6.2" />
      <circle cx="9" cy="19.5" r="1.4" />
      <circle cx="17" cy="19.5" r="1.4" />
    </ng-container>
    <ng-container *ngSwitchCase="'about'">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 7.6v.1" />
    </ng-container>
    <ng-container *ngSwitchCase="'mail'">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 7 8 6 8-6" />
    </ng-container>
    <ng-container *ngSwitchCase="'user'">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5" />
    </ng-container>
    <ng-container *ngSwitchCase="'workspace'">
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </ng-container>
    <ng-container *ngSwitchCase="'close'">
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </ng-container>
    <ng-container *ngSwitchCase="'menu-lines'">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h10" />
    </ng-container>
    <ng-container *ngSwitchCase="'chevron'"><path d="m9 6 6 6-6 6" /></ng-container>
    <ng-container *ngSwitchCase="'logout'">
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="M16 8l4 4-4 4" />
      <path d="M20 12H9" />
    </ng-container>
  </svg>`,
})
export class IconComponent {
  readonly name = input.required<IconName>();
}
