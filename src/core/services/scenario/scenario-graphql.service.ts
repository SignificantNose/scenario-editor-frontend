import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { catchError, map, Observable, throwError } from 'rxjs';
import * as v from 'valibot';
import {
  ScenarioData,
  ScenarioDataSchema,
  ListScenarioDataResponse,
  ListScenarioDataResponseSchema,
} from '@models/scenario/list-scenario-data.model';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { RoutePaths } from 'app/app.router-path';

@Injectable({ providedIn: 'root' })
export class ScenarioGraphqlService {
  private apollo = inject(Apollo);
  private router = inject(Router);
  private authService = inject(AuthService);

  listScenarios(): Observable<ListScenarioDataResponse> {
    return this.apollo
      .query<{ scenarios: unknown }>({
        query: gql`
          query {
            scenarios {
              id
              name
              createdAt
              updatedAt
              emitters {
                id
                audioFileUri
                position { x y z }
              }
              listeners {
                id
                position { x y z }
              }
            }
          }
        `,
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          const parsed = v.safeParse(ListScenarioDataResponseSchema, result.data?.scenarios);
          if (!parsed.success) {
            console.error('Validation failed', parsed.issues);
            throw new Error('Invalid scenario data received from server');
          }
          return parsed.output;
        }),
        catchError((err) => {
          if (err?.networkError?.statusCode === 401) {
            this.authService.logout();
            this.router.navigate([`/${RoutePaths.Auth}`]);
          }
          return throwError(() => err);
        }),
      );
  }

  getScenario(id: number): Observable<ScenarioData> {
    return this.apollo
      .query<{ scenario: unknown }>({
        query: gql`
          query($id: Int!) {
            scenario(id: $id) {
              id
              name
              createdAt
              updatedAt
              emitters {
                id
                audioFileUri
                position { x y z }
              }
              listeners {
                id
                position { x y z }
              }
            }
          }
        `,
        variables: { id },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          const parsed = v.safeParse(ScenarioDataSchema, result.data?.scenario);
          if (!parsed.success) {
            console.error('Validation failed', parsed.issues);
            throw new Error('Invalid scenario data received from server');
          }
          return parsed.output;
        }),
        catchError((err) => {
          if (err?.networkError?.statusCode === 401) {
            this.authService.logout();
            this.router.navigate([`/${RoutePaths.Auth}`]);
          }
          return throwError(() => err);
        }),
      );
  }
}

