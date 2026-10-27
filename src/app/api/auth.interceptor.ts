import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { SessionService } from './session.service';

/** A 401 from these means "wrong credentials", not "your session ended". */
const isCredentialCheck = (url: string) => /\/auth\/(login|register)$/.test(url);

/** Sends the bearer token to the API only, and ends the session when the API rejects it. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);
  const session = inject(SessionService);
  const token = session.token();
  const outgoing = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(outgoing).pipe(
    tap({
      error: (error) => {
        if (
          token &&
          error instanceof HttpErrorResponse &&
          error.status === 401 &&
          !isCredentialCheck(req.url)
        )
          session.clear(true);
      },
    }),
  );
};
