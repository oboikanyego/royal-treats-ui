import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { environment } from '../../environments/environment';
import { Busy } from '../busy.service';

/** Counts requests to the API that have not answered yet, so the shell can show a loading bar. */
export const busyInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);
  const busy = inject(Busy);
  busy.requestStarted();
  return next(req).pipe(finalize(() => busy.requestFinished()));
};
