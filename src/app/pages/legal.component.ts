import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommerceState } from '../commerce-state.service';
import { LEGAL_UPDATED, privacySections, termsSections } from '../legal';

/** The privacy notice and the terms, chosen by the route's `data.legal`. */
@Component({
  selector: 'section[rt-legal]',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './legal.component.html',
  host: { class: 'legal-page' },
})
export class LegalComponent {
  private readonly store = inject(CommerceState);
  readonly kind: 'privacy' | 'terms' =
    inject(ActivatedRoute).snapshot.data['legal'] === 'terms' ? 'terms' : 'privacy';
  readonly title = this.kind === 'terms' ? 'Terms of Use' : 'Privacy Notice';
  readonly updated = LEGAL_UPDATED;
  readonly sections = computed(() => {
    const shop = this.store.settings();
    return this.kind === 'terms' ? termsSections(shop) : privacySections(shop);
  });
}
