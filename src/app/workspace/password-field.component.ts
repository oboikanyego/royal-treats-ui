import { CommonModule } from '@angular/common';
import { Component, ViewEncapsulation, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * A labelled password box with a Show / Hide button. Two-way bound with `[(value)]`. Used inside the
 * portal's shadow root, so the portal's stylesheet styles it.
 */
@Component({
  selector: 'rt-password-field',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './password-field.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class PasswordFieldComponent {
  readonly label = input.required<string>();
  readonly name = input('password');
  readonly autocomplete = input('current-password');
  readonly minlength = input<number | null>(null);
  readonly value = model('');
  readonly visible = signal(false);
}
