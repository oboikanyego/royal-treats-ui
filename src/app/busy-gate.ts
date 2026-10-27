/**
 * Turns "work started / work finished" into "show a loader / hide it", without flashing for work
 * that ends quickly: the loader only appears once the work has lasted `showAfterMs`.
 */
export class BusyGate {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private working = false;

  constructor(
    private readonly showAfterMs: number,
    private readonly onVisible: (visible: boolean) => void,
  ) {}

  set(working: boolean): void {
    if (working === this.working) return; // a second start must not restart the wait
    this.working = working;
    if (working) {
      this.timer = setTimeout(() => this.onVisible(true), this.showAfterMs);
    } else {
      clearTimeout(this.timer);
      this.onVisible(false);
    }
  }
}
