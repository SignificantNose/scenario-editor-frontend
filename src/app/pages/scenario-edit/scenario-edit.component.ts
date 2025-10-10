import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ScenarioDesignerComponent } from '@shared/scenario-designer/scenario-designer.component';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ScenarioData } from '@models/scenario/list-scenario-data.model';
import { ScenarioGraphqlService } from 'core/services/scenario/scenario-graphql.service';

@Component({
  selector: 'app-scenario-edit',
  templateUrl: './scenario-edit.component.html',
  styleUrls: ['./scenario-edit.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ScenarioDesignerComponent,
    MatButtonModule,
    MatToolbarModule,
    MatIconModule,
    MatInputModule,
  ],
})
export class ScenarioEditComponent implements OnInit {
  @ViewChild('designer') scenarioDesigner: ScenarioDesignerComponent | null = null;

  scenario: ScenarioData | null = null;
  private graphql = inject(ScenarioGraphqlService);

  constructor(
    private router: Router,
    private route: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? Number(idParam) : null;

    if (!id) {
      console.error('Invalid scenario id');
      this.router.navigate(['/']);
      return;
    }

    this.graphql.getScenario(id).subscribe({
      next: (data) => {
        this.scenario = data;
      },
      error: (err) => {
        console.error('Failed to fetch scenario:', err);
        this.router.navigate(['/']);
      },
    });

    // this.scenarioService.get(id).subscribe({
    //   next: (data) => {
    //     this.scenario = data;
    //   },
    //   error: (err) => {
    //     console.error('Failed to fetch scenario:', err);
    //     this.router.navigate(['/']);
    //   },
    // });
  }

  cancel() {
    this.router.navigate(['/']);
  }

  saveChanges() {
    if (!this.scenarioDesigner || !this.scenarioDesigner.isValid || !this.scenario) {
      console.warn('Form invalid or scenario not loaded.');
      return;
    }

    const updatedScenario = this.scenarioDesigner.getScenario();
    this.graphql.updateScenario(updatedScenario.id, updatedScenario).subscribe({
      next: () => {
        console.log('Scenario changes saved:', updatedScenario);
        this.router.navigate(['/']);
      },
      error: (err) => {
        console.error('Failed to save scenario:', err);
      },
    });
    ;


    // this.scenarioService.update(updatedScenario.id, updatedScenario).subscribe({
    //   next: () => {
    //     console.log('Scenario changes saved:', updatedScenario);
    //     this.router.navigate(['/']);
    //   },
    //   error: (err) => {
    //     console.error('Failed to save scenario:', err);
    //   },
    // });
  }
}
