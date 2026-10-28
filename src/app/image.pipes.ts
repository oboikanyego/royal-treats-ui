import { Pipe, PipeTransform } from '@angular/core';
import { imageAt, imageSet } from './image-url';

/** `[src]="p.image | imgSrc: 400"`: the picture at the width the screen needs. */
@Pipe({ name: 'imgSrc', standalone: true })
export class ImageSrcPipe implements PipeTransform {
  transform(url: string | null | undefined, width: number): string {
    return imageAt(url, width);
  }
}

/** `[attr.srcset]="p.image | imgSet: [320, 480, 640]"`: lets the browser pick the right size. */
@Pipe({ name: 'imgSet', standalone: true })
export class ImageSetPipe implements PipeTransform {
  transform(url: string | null | undefined, widths: readonly number[]): string | null {
    return imageSet(url, widths) || null;
  }
}
