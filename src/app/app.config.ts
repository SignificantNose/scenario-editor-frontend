import { provideApollo } from 'apollo-angular';
import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { HttpLink } from 'apollo-angular/http';
import { InMemoryCache } from '@apollo/client';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes), provideClientHydration(withEventReplay()),
    provideClientHydration(withEventReplay()),
    provideApollo(() => {
      const httpLink = inject(HttpLink);

      return {
        link: httpLink.create({uri: 'http://localhost:3000/graphql'}),
        cache: new InMemoryCache()
      }
    })
  ]
};
