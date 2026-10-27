import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  provideRouter,
  TitleStrategy,
  withInMemoryScrolling,
  withPreloading,
} from '@angular/router';
import { authInterceptor } from './app/api/auth.interceptor';
import { busyInterceptor } from './app/api/busy.interceptor';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { clearLegacyDemoData } from './app/legacy-storage';
import { PreloadMarked } from './app/preload';
import { RoyalTitleStrategy } from './app/title.strategy';

try {
  clearLegacyDemoData(localStorage, sessionStorage);
} catch {
  // Browser storage is blocked; there is nothing to clean up.
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
      withPreloading(PreloadMarked),
    ),
    { provide: TitleStrategy, useClass: RoyalTitleStrategy },
    provideHttpClient(withFetch(), withInterceptors([busyInterceptor, authInterceptor])),
  ],
}).catch(console.error);
