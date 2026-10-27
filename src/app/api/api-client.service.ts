import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, retry, throwError, timeout, timer } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiRequestError, isTransient, toApiError } from './api-errors';

/** Render's free plan can take about a minute to wake a sleeping service. */
const REQUEST_TIMEOUT_MS = 75_000;
const READ_RETRIES = 2;

/** Thin wrapper over HttpClient for royal-treats-api: base URL, timeout, retries for reads, error mapping. */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  /** GET with up to two retries on network failures, timeouts and gateway errors. */
  get<T>(path: string, params?: Record<string, string | number | boolean>): Observable<T> {
    return this.http.get<T>(environment.apiUrl + path, { params }).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      catchError((failure) => throwError(() => toApiError(failure))),
      retry({
        count: READ_RETRIES,
        delay: (error: ApiRequestError, attempt) =>
          isTransient(error) ? timer(1500 * attempt) : throwError(() => error),
      }),
    );
  }
}
