import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatExpansionModule } from '@angular/material/expansion';

import { ScenarioService } from 'core/services/scenario/scenario.service';
import { ScenarioData } from '@models/scenario/list-scenario-data.model';
import { Apollo, gql } from 'apollo-angular';
import { ScenarioGraphqlService } from 'core/services/scenario/scenario-graphql.service';

@Component({
  selector: 'app-scenario-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatToolbarModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatExpansionModule,
  ],
  templateUrl: './scenario-list.component.html',
  styleUrls: ['./scenario-list.component.scss'],
})
export class ScenarioListComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private api = inject(ScenarioService);
  private fb = inject(FormBuilder);
  private graphql = inject(ScenarioGraphqlService);

  scenarios: ScenarioData[] = [];
  loading = true;
  error = '';

  filterForm = this.fb.group({
    name: this.fb.control<string | null>(null),
    createdAfter: this.fb.control<Date | null>(null),
    createdBefore: this.fb.control<Date | null>(null),
    updatedAfter: this.fb.control<Date | null>(null),
    updatedBefore: this.fb.control<Date | null>(null),
    minDevices: this.fb.control<number | null>(null),
    maxDevices: this.fb.control<number | null>(null),
  });

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      const patch: any = {
        ...params,
        createdAfter: params['createdAfter'] ? new Date(params['createdAfter']) : null,
        createdBefore: params['createdBefore'] ? new Date(params['createdBefore']) : null,
        updatedAfter: params['updatedAfter'] ? new Date(params['updatedAfter']) : null,
        updatedBefore: params['updatedBefore'] ? new Date(params['updatedBefore']) : null,
      };

      this.filterForm.patchValue(patch, { emitEvent: false });
      this.fetch(params);
    });
  }

  private formatDateForQuery(date: Date | null | undefined): string | undefined {
    if (!date) return undefined;

    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  applyFilters() {
    const values = this.filterForm.value;

    const query: any = {
      ...values,
      createdAfter: this.formatDateForQuery(values.createdAfter),
      createdBefore: this.formatDateForQuery(values.createdBefore),
      updatedAfter: this.formatDateForQuery(values.updatedAfter),
      updatedBefore: this.formatDateForQuery(values.updatedBefore),
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: query,
    });
  }

  resetFilters() {
    this.filterForm.reset();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
    });
  }

  private fetch(filter: any) {
    this.loading = true;
    this.graphql.listScenarios().subscribe({
      next: (res) => {
        this.scenarios = res;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to load scenarios';
        this.loading = false;
      },
    });
    // this.api.list(filter).subscribe({
    //   next: (res) => {
    //     this.scenarios = res;
    //     this.loading = false;
    //   },
    //   error: (err) => {
    //     this.error = err?.error?.error || 'Failed to load scenarios';
    //     this.loading = false;
    //   },
    // });
  }

  createScenario() {
    this.router.navigate(['/editor/new']);
  }

  editScenario(id: number) {
    this.router.navigate([`/editor/${id}`]);
  }

  deleteScenario(id: number) {
    this.api.delete({ id }).subscribe({
      next: () => {
        this.scenarios = this.scenarios.filter((s) => s.id !== id);
      },
      error: (err) => {
        this.error = err?.error?.error || 'Failed to delete scenario';
      },
    });
  }
}
