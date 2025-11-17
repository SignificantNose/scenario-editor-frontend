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
import { updateDesignedObjectTransform } from 'core/utils/designer-object-creator.util';
import { MinEmitterHeightMeters } from 'core/const/scenario.const';

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
  ],
})
export class EmitterEditorComponent implements OnInit, OnDestroy {
  @Input() designedEmitter: DesignedEmitter | null = null;
  @Output() save = new EventEmitter<EmitterData>();
  @Output() cancel = new EventEmitter<void>();
  @Output() objectTransformChanged = new EventEmitter<void>();

  minEmitterHeightMeters = MinEmitterHeightMeters;
  editForm = new FormGroup({
    height: new FormControl<number | null>(null, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(this.minEmitterHeightMeters)],
    }),
    audioFileUri: new FormControl<string | null>(null, {
      nonNullable: false,
    }),
  });
  private formSubscription: Subscription | null = null;

  constructor(private audioFileService: AudioFileService) { }

  ngOnInit(): void {
    const emitter = this.designedEmitter;
    if (!emitter) {
      return;
    }
    this.editForm.patchValue({
      height: emitter.data.position.y,
      audioFileUri: emitter.data.audioFileUri,
    });

    this.formSubscription = this.editForm.valueChanges.subscribe((value) => {
      updateDesignedObjectTransform(emitter, {
        height: value.height ?? undefined,
        audioFileUri: value.audioFileUri ?? undefined,
      });
      this.objectTransformChanged.emit();
    });
  }

  ngOnDestroy(): void {
    this.formSubscription?.unsubscribe();
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

    this.audioFileService.uploadAudio(file).subscribe({
      next: (result) => {
        this.editForm?.controls['audioFileUri'].setValue(result.uri);
      },
      error: (err) => {
        console.error('Upload failed', err);
        alert('File upload failed');
      },
    });
  }

  onSave(): void {
    const form = this.editForm;
    if (!form || !this.designedEmitter || !form.valid) {
      return;
    }
    const { height, audioFileUri } = form.value;
    if (height == null) {
      return;
    }

    this.designedEmitter.data.position.y = height;
    this.designedEmitter.data.audioFileUri = audioFileUri ?? null;
    this.save.emit(this.designedEmitter.data);
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
