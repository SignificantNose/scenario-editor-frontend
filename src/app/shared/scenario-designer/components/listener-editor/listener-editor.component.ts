import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DesignedListener } from '@models/designer/designer.model';
import { ListenerData } from '@models/scenario/list-scenario-data.model';
import { Subscription } from 'rxjs';
import { updateDesignedObjectTransform } from 'core/utils/designer-object-creator.util';
import { MatCardModule } from '@angular/material/card';
import {
  MaxListenerRotation,
  MinListenerHeightMeters,
  MinListenerRotation,
} from 'core/const/scenario.const';

@Component({
  selector: 'app-listener-editor',
  templateUrl: './listener-editor.component.html',
  styleUrls: ['./listener-editor.component.scss'],
  standalone: true,
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    MatButtonModule,
  ],
})
export class ListenerEditorComponent implements OnInit, OnDestroy {
  @Input() designedListener!: DesignedListener;
  @Output() save = new EventEmitter<ListenerData>();
  @Output() cancel = new EventEmitter<void>();
  @Output() objectTransformChanged = new EventEmitter<void>();

  minListenerHeightMeters = MinListenerHeightMeters;
  minListenerRotation = MinListenerRotation;
  maxListenerRotation = MaxListenerRotation;

  editForm = new FormGroup({
    height: new FormControl<number | null>(null, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(this.minListenerHeightMeters)],
    }),
    rotation: new FormControl<number | null>(null, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(this.minListenerRotation),
        Validators.max(this.maxListenerRotation),
      ],
    }),
  });
  private formSubscription: Subscription | null = null;

  ngOnInit(): void {
    this.editForm.patchValue({
      height: this.designedListener.data.position.y,
      rotation: this.designedListener.data.rotation,
    });
    this.formSubscription = this.editForm.valueChanges.subscribe((value) => {
      updateDesignedObjectTransform(this.designedListener, {
        height: value.height ?? undefined,
        rotation: value.rotation ?? undefined,
      });
      this.objectTransformChanged.emit();
    });
  }

  ngOnDestroy(): void {
    this.formSubscription?.unsubscribe();
  }

  onSave(): void {
    if (!this.editForm.valid) {
      return;
    }
    const { height, rotation } = this.editForm.value;
    if (height == null || rotation == null) {
      return;
    }

    this.designedListener.data.position.y = height;
    this.designedListener.data.rotation = rotation;

    this.save.emit(this.designedListener.data);
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
