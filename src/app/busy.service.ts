import { Injectable, inject, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationStart,
  Router,
} from '@angular/router';
import { BusyGate } from './busy-gate';

/** Long enough that a quick page change or request never flashes a bar, short enough to feel live. */
const SHOW_AFTER_MS = 200;

/**
 * What the shell needs to show "something is loading": a page change in progress (the route's code
 * or data is still arriving) or any request to the API that has not answered yet.
 */
@Injectable({ providedIn: 'root' })
export class Busy {
  private requests = 0;
  private readonly navigating = signal(false);
  /** True from the moment a page change starts until it ends, however it ends. */
  readonly navigationInProgress = this.navigating.asReadonly();
  /** True once work has lasted a moment; this drives the loading bar. */
  readonly visible = signal(false);
  private readonly gate = new BusyGate(SHOW_AFTER_MS, (visible) => this.visible.set(visible));

  constructor() {
    inject(Router).events.subscribe((event) => {
      if (event instanceof NavigationStart) this.navigating.set(true);
      else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError ||
        event instanceof NavigationSkipped
      )
        this.navigating.set(false);
      this.update();
    });
  }

  requestStarted(): void {
    this.requests++;
    this.update();
  }

  requestFinished(): void {
    this.requests = Math.max(0, this.requests - 1);
    this.update();
  }

  private update(): void {
    this.gate.set(this.navigating() || this.requests > 0);
  }
}
