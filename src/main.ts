import { provideHttpClient, withFetch } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, TitleStrategy, withInMemoryScrolling } from '@angular/router';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { RoyalTitleStrategy } from './app/title.strategy';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
    { provide: TitleStrategy, useClass: RoyalTitleStrategy },
    provideHttpClient(withFetch()),
  ],
}).catch(console.error);
