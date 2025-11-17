import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { map, Observable } from 'rxjs';
import * as v from 'valibot';
import {
  ScenarioData,
  ScenarioDataSchema,
  ListScenarioDataResponse,
  ListScenarioDataResponseSchema,
} from '@models/scenario/list-scenario-data.model';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { CreateScenarioData } from '@models/scenario/create-scenario-data.model';

@Injectable({ providedIn: 'root' })
export class ScenarioGraphqlService {
  private apollo = inject(Apollo);

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
                rotation
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
                rotation
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
      );
  }

  createScenario(data: CreateScenarioData): Observable<number> {
    return this.apollo
      .mutate<{ createScenario: number }, CreateScenarioData>({
        // @ts-ignore
        mutation: gql`
          mutation CreateScenario($name: String!, $emitters: [EmitterInput], $listeners: [ListenerInput])
          {
            createScenario(name: $name, emitters: $emitters, listeners: $listeners)
          }
        `,
        variables: {
          name: data.name,
          emitters: data.emitters ?? [],
          listeners: data.listeners ?? [],
        },
      })
      .pipe(
        map((result) => {
          const id = result.data?.createScenario;
          if (id == null) throw new Error('Failed to create scenario');
          return id;
        }),
      );
  }

  updateScenario(id: number, data: CreateScenarioData): Observable<boolean> {
    return this.apollo
      .mutate<{ updateScenario: boolean }, { id: number } & CreateScenarioData>({
        // @ts-ignore
        mutation: gql`
          mutation UpdateScenario(
            $id: Int!
            $name: String!
            $emitters: [EmitterInput]
            $listeners: [ListenerInput]
          ) {
            updateScenario(id: $id, name: $name, emitters: $emitters, listeners: $listeners)
          }
        `,
        variables: {
          id,
          name: data.name,
          emitters: data.emitters ?? [],
          listeners: data.listeners ?? [],
        },
      })
      .pipe(
        map((result) => {
          const ok = result.data?.updateScenario;
          if (typeof ok !== 'boolean') throw new Error('Failed to update scenario');
          return ok;
        }),
      );
  }

  deleteScenario(id: number): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteScenario: boolean }, { id: number }>({
        // @ts-ignore
        mutation: gql`
          mutation DeleteScenario($id: Int!) {
            deleteScenario(id: $id)
          }
        `,
        variables: { id },
      })
      .pipe(
        map((result) => {
          const ok = result.data?.deleteScenario;
          if (typeof ok !== 'boolean') throw new Error('Failed to delete scenario');
          return ok;
        }),
      );
  }
}

