import { Pipe, PipeTransform } from '@angular/core';
import { formatRand } from './money';

/** `{{ price | rand }}` -> "R25", or "R25.50" when there are cents. */
@Pipe({ name: 'rand', standalone: true })
export class RandPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatRand(value);
  }
}
