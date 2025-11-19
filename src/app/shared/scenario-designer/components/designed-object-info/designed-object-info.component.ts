import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { DesignedObject } from '@models/designer/designer.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-designed-object-info',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule],
  templateUrl: './designed-object-info.component.html',
  styleUrls: ['./designed-object-info.component.scss'],
})
export class DesignedObjectInfoComponent {
  @Input() selectedObject: DesignedObject | null = null;
  @Input() editMode = false;

  @Output() delete = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();

  onDelete() {
    this.delete.emit();
  }

  onEdit() {
    this.edit.emit();
  }
}
