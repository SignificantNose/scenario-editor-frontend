import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ListScenarioDataResponse, ScenarioData } from '@models/scenario/list-scenario-data.model';
import { CreateScenarioData } from '@models/scenario/create-scenario-data.model';
import { UpdateScenarioData } from '@models/scenario/update-scenario-data.model';
import { DeleteScenarioData } from '@models/scenario/delete-scenario-data.model';
import { ScenarioFilter } from '@models/scenario/filter.model';
import { AppConfigService } from '../config/app-config.service';
import { ApiService } from '../api/api.service';
import { HttpParams } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class ScenarioService {
  private appConfigService = inject(AppConfigService);
  private controller = `${this.appConfigService.config?.apiUrl ?? ''}/api/v1/scenario`;

  constructor(private api: ApiService) { }

  list(filter: ScenarioFilter | null = null): Observable<ListScenarioDataResponse> {
    let params = new HttpParams();

    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params = params.set(key, value);
        }
      });
    }

    return this.api.get<ListScenarioDataResponse>(this.controller, params);
  }

  get(id: number | string): Observable<ScenarioData> {
    return this.api.get<ScenarioData>(`${this.controller}/${id}`);
  }

  create(data: CreateScenarioData): Observable<ScenarioData> {
    return this.api.post<ScenarioData>(this.controller, data);
  }

  update(id: number | string, data: UpdateScenarioData): Observable<ScenarioData> {
    return this.api.put<ScenarioData>(`${this.controller}/${id}`, data);
  }

  delete(data: DeleteScenarioData): Observable<void> {
    return this.api.delete<void>(`${this.controller}/${data.id}`);
  }
}
