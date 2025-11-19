import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { DesignedEmitter } from '@models/designer/designer.model';
import { EmitterData } from '@models/scenario/list-scenario-data.model';
import { AudioFileService } from 'core/services/audio/audio-file.service';
import { Subscription } from 'rxjs';
import { MinEmitterHeightMeters } from 'core/const/scenario.const';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

export type EmitterEditTarget = 'start' | 'end';

@Component({
  selector: 'app-emitter-editor',
  templateUrl: './emitter-editor.component.html',
  styleUrls: ['./emitter-editor.component.scss'],
  standalone: true,
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
  ],
})
export class EmitterEditorComponent implements OnInit, OnDestroy {
  @Input() designedEmitter: DesignedEmitter | null = null;
  @Output() save = new EventEmitter<EmitterData>();
  @Output() cancel = new EventEmitter<void>();
  @Output() objectTransformChanged = new EventEmitter<void>();
  @Output() editTargetChanged = new EventEmitter<EmitterEditTarget>();

  minEmitterHeightMeters = MinEmitterHeightMeters;
  activeEditTarget: EmitterEditTarget = 'start';
  editForm = new FormGroup({
    startHeight: new FormControl<number | null>(null, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(this.minEmitterHeightMeters)],
    }),
    startTime: new FormControl<number | null>(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    hasEndPoint: new FormControl<boolean>(false, { nonNullable: true }),
    endHeight: new FormControl<number | null>(null, {
      validators: [Validators.min(this.minEmitterHeightMeters)],
    }),
    endTime: new FormControl<number | null>(null, {
      validators: [Validators.min(0)],
    }),
    audioFileUri: new FormControl<string | null>(null, {
      nonNullable: false,
    }),
  });
  private formSubscription: Subscription | null = null;

  constructor(private audioFileService: AudioFileService) { }

  ngOnInit(): void {
    if (!this.designedEmitter) {
      return;
    }

    const data = this.designedEmitter.data;
    const hasEnd = !!data.endPoint;

    this.editForm.patchValue({
      startHeight: data.startPoint.y,
      startTime: data.startTime,
      hasEndPoint: hasEnd,
      endHeight: data.endPoint?.y ?? data.startPoint.y,
      endTime: data.endTime,
      audioFileUri: data.audioFileUri,
    });

    this.formSubscription = this.editForm.valueChanges.subscribe((val) => {
      if (val.hasEndPoint !== !!this.designedEmitter?.data.endPoint) {
        this.updateValidatorState(val.hasEndPoint ?? false);
      }

      this.syncDataToModel();
    });
  }

  ngOnDestroy(): void {
    this.formSubscription?.unsubscribe();
  }

  setEditTarget(target: EmitterEditTarget) {
    this.activeEditTarget = target;
    this.editTargetChanged.emit(target);
  }

  toggleEndPoint(enable: boolean) {
    this.editForm.controls.hasEndPoint.setValue(enable);

    if (enable) {
      if (this.editForm.controls.endHeight.value === null) {
        this.editForm.controls.endHeight.setValue(this.editForm.controls.startHeight.value);
      }
      this.setEditTarget('end');
    } else {
      this.setEditTarget('start');
      this.editForm.controls.endHeight.setValue(null);
      this.editForm.controls.endTime.setValue(null);
    }
  }
  private updateValidatorState(hasEnd: boolean) {
    const endHeightCtrl = this.editForm.controls.endHeight;
    const endTimeCtrl = this.editForm.controls.endTime;

    if (hasEnd) {
      endHeightCtrl.addValidators([
        Validators.required,
        Validators.min(this.minEmitterHeightMeters),
      ]);
    } else {
      endHeightCtrl.clearValidators();
    }
    endHeightCtrl.updateValueAndValidity({ emitEvent: false });
  }

  private syncDataToModel() {
    if (!this.designedEmitter) return;
    const val = this.editForm.getRawValue();

    this.designedEmitter.data.startPoint.y = val.startHeight ?? MinEmitterHeightMeters;
    this.designedEmitter.data.startTime = val.startTime ?? 0;
    this.designedEmitter.data.audioFileUri = val.audioFileUri;

    if (val.hasEndPoint) {
      if (!this.designedEmitter.data.endPoint) {
        this.designedEmitter.data.endPoint = { ...this.designedEmitter.data.startPoint };
      }
      this.designedEmitter.data.endPoint.y =
        val.endHeight ?? val.startHeight ?? MinEmitterHeightMeters;
      this.designedEmitter.data.endTime = val.endTime;
    } else {
      this.designedEmitter.data.endPoint = null;
      this.designedEmitter.data.endTime = null;
    }

    this.objectTransformChanged.emit();
  }

  onAudioSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      return;
    }

    const file = input.files[0];
    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file');
      return;
    }
    this.audioFileService.uploadAudio(input.files[0]).subscribe((res) => {
      this.editForm.patchValue({ audioFileUri: res.uri });
    });
  }

  onSave(): void {
    if (this.editForm.valid && this.designedEmitter) {
      this.save.emit(this.designedEmitter.data);
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }

  // onAudioSelected(event: Event) {
  //   const input = event.target as HTMLInputElement;
  //   if (!input.files?.length) {
  //     return;
  //   }
  //   const file = input.files[0];
  //   if (!file.type.startsWith('audio/')) {
  //     alert('Please select an audio file');
  //     return;
  //   }
  //
  //   this.audioFileService.uploadAudio(file).subscribe({
  //     next: (result) => {
  //       this.editForm?.controls['audioFileUri'].setValue(result.uri);
  //     },
  //     error: (err) => {
  //       console.error('Upload failed', err);
  //       alert('File upload failed');
  //     },
  //   });
  // }
  //
  // onSave(): void {
  //   const form = this.editForm;
  //   if (!form || !this.designedEmitter || !form.valid) {
  //     return;
  //   }
  //   const { height, audioFileUri } = form.value;
  //   if (height == null) {
  //     return;
  //   }
  //
  //   this.designedEmitter.data.position.y = height;
  //   this.designedEmitter.data.audioFileUri = audioFileUri ?? null;
  //   this.save.emit(this.designedEmitter.data);
  // }
  //
  // onCancel(): void {
  //   this.cancel.emit();
  // }
}
