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

  /** GET a binary response (an image). Not retried: used for optional extras. */
  getBlob(path: string): Observable<Blob> {
    return this.once(this.http.get(environment.apiUrl + path, { responseType: 'blob' }));
  }

  /** GET a text response (a receipt's HTML). Not retried: the person is waiting for it. */
  getText(path: string): Observable<string> {
    return this.once(
      this.http.get(environment.apiUrl + path, {
        responseType: 'text',
        headers: { Accept: 'text/html' },
      }),
    );
  }

  /** POST that answers with text (a template preview). */
  postText(path: string, body: unknown): Observable<string> {
    return this.once(
      this.http.post(environment.apiUrl + path, body, {
        responseType: 'text',
        headers: { Accept: 'text/html' },
      }),
    );
  }

  /** DELETE with a JSON answer. */
  delete<T>(path: string): Observable<T> {
    return this.once(this.http.delete<T>(environment.apiUrl + path));
  }

  /** Writes are never retried automatically: repeating a sign-in or an order is not always safe. */
  post<T>(path: string, body: unknown = {}, headers?: Record<string, string>): Observable<T> {
    return this.once(this.http.post<T>(environment.apiUrl + path, body, { headers }));
  }
  patch<T>(path: string, body: unknown): Observable<T> {
    return this.once(this.http.patch<T>(environment.apiUrl + path, body));
  }
  put<T>(path: string, body: unknown): Observable<T> {
    return this.once(this.http.put<T>(environment.apiUrl + path, body));
  }

  private once<T>(request: Observable<T>): Observable<T> {
    return request.pipe(
      timeout(REQUEST_TIMEOUT_MS),
      catchError((failure) => throwError(() => toApiError(failure))),
    );
  }
}
