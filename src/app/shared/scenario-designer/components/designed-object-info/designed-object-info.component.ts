import { Component, Input, Output, EventEmitter } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { DesignedObject } from '@models/designer/designer.model';

@Component({
  selector: 'app-designed-object-info',
  templateUrl: './designed-object-info.component.html',
  styleUrls: ['./designed-object-info.component.scss'],
  standalone: true,
  imports: [MatCardModule, MatButtonModule],
})
export class DesignedObjectInfoComponent {
  @Input() selectedObject: DesignedObject | null = null;
  @Input() editMode: boolean = false;
  @Output() delete = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();

  onDelete(): void {
    this.delete.emit();
  }

  onEdit(): void {
    this.edit.emit();
  }
}
