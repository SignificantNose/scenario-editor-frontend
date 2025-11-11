import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  NgZone,
  Input,
  OnInit,
  OnDestroy,
} from '@angular/core';
import * as THREE from 'three';
import { ScenarioData, EmitterData, ListenerData } from '@models/scenario/list-scenario-data.model';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ScenarioNameRegex } from 'app/const/app.defaults';
import { debounceTime, Subject, Subscription, takeUntil } from 'rxjs';
import { AudioFileService } from 'core/services/audio/audio-file.service';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DesignedEmitter, DesignedListener, DesignedObject } from '@models/designer/designer.model';
import {
  createEmitterDisplay,
  createListenerDisplay,
  getClickableParts,
  highlightDesignedObject,
  markObjectAsEdited,
  restoreDefaultColors,
} from 'core/utils/designer-object-creator.util';
import { MinEmitterHeightMeters } from 'core/const/scenario.const';

@Component({
  selector: 'app-scenario-designer',
  templateUrl: './scenario-designer.component.html',
  styleUrls: ['./scenario-designer.component.scss'],
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
  ],
  standalone: true,
})
export class ScenarioDesignerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: false })
  canvasRef: ElementRef<HTMLCanvasElement> | null = null;

  form = new FormGroup({
    name: new FormControl<string | null>(null, {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(ScenarioNameRegex)],
    }),
  });
  isValid = false;
  selectedObject: DesignedObject | null = null;

  private clock = new THREE.Clock();

  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;

  private lookSensitivity = 0.005;
  private moveSpeed = 6;

  private yaw = 0;
  private pitch = 0;

  private isDragging = false;
  private isMouseDown = false;
  private mouseLeftCanvas = false;
  private dragThreshold = 5;
  private dragStart = { x: 0, y: 0 };

  private boundMouseDown: ((e: MouseEvent) => void) | null = null;
  private boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundMouseUp: ((e: MouseEvent) => void) | null = null;
  private boundMouseLeave: ((e: MouseEvent) => void) | null = null;
  private boundMouseEnter: ((e: MouseEvent) => void) | null = null;
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private boundResize: (() => void) | null = null;

  private _scenario: ScenarioData | null = null;

  @Input()
  set scenario(value: ScenarioData | null) {
    this._scenario = value;
  }

  get scenario(): ScenarioData | null {
    return this._scenario;
  }

  private $destroy = new Subject<void>();

  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private raycaster = new THREE.Raycaster();

  private ground: THREE.Mesh | null = null;
  private preObjectMesh: THREE.Mesh | null = null;
  private preObjectPosition: THREE.Vector3 | null = null;

  private _internalScenario: ScenarioData = {
    id: 0,
    name: 'New Scenario',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    emitters: [],
    listeners: [],
  };

  private emitterDisplays: Map<number, DesignedEmitter> = new Map();
  private listenerDisplays: Map<number, DesignedListener> = new Map();

  private _idCounter = 0;

  editMode = false;
  editForm: FormGroup | null = null;
  private editClone: DesignedObject | null = null;
  private editingOriginal: DesignedObject | null = null;
  private editFormSub: Subscription | null = null;

  constructor(
    private ngZone: NgZone,
    private audioFileService: AudioFileService,
  ) { }

  ngOnInit() {
    this.isValid = this.form.valid;
    this.form.statusChanges.pipe(takeUntil(this.$destroy)).subscribe(() => {
      this.isValid = this.form.valid;
    });
  }

  ngAfterViewInit(): void {
    if (!this.canvasRef) {
      return;
    }

    const canvas = this.canvasRef.nativeElement;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xeeeeee);

    this.camera = new THREE.PerspectiveCamera(
      75,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      1000,
    );
    this.camera.position.set(0, 5, 10);
    this.updateCameraLook();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    const gridHelper = new THREE.GridHelper(100, 100, 0x999999, 0xcccccc);
    const planeGeometry = new THREE.PlaneGeometry(100, 100);
    const planeMaterial = new THREE.MeshBasicMaterial({ visible: false });
    this.ground = new THREE.Mesh(planeGeometry, planeMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.scene.add(this.ground);
    this.scene.add(gridHelper);

    this.boundMouseDown = (e) => this.onMouseDown(e);
    this.boundMouseMove = (e) => this.onMouseMove(e);
    this.boundMouseUp = (e) => this.onMouseUp(e);
    this.boundMouseLeave = (e) => this.onMouseLeave(e);
    this.boundMouseEnter = (e) => this.onMouseEnter(e);
    this.boundKeyDown = (e) => this.onKeyDown(e);
    this.boundKeyUp = (e) => this.onKeyUp(e);
    this.boundResize = () => this.onResize();

    canvas.addEventListener('mousedown', this.boundMouseDown, { passive: false });
    canvas.addEventListener('mousemove', this.boundMouseMove, { passive: false });
    canvas.addEventListener('mouseleave', this.boundMouseLeave, { passive: false });
    canvas.addEventListener('mouseenter', this.boundMouseEnter, { passive: false });
    window.addEventListener('mouseup', this.boundMouseUp, { passive: false });

    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);

    window.addEventListener('resize', this.boundResize);

    this.ngZone.runOutsideAngular(() => this.animate());
  }

  ngOnDestroy(): void {
    if (this.canvasRef) {
      const canvas = this.canvasRef.nativeElement;
      if (this.boundMouseDown) {
        canvas.removeEventListener('mousedown', this.boundMouseDown);
      }
      if (this.boundMouseMove) {
        canvas.removeEventListener('mousemove', this.boundMouseMove);
      }
      if (this.boundMouseLeave) {
        canvas.removeEventListener('mouseleave', this.boundMouseLeave);
      }
      if (this.boundMouseEnter) {
        canvas.removeEventListener('mouseenter', this.boundMouseEnter);
      }
      if (this.boundMouseUp) {
        window.removeEventListener('mouseup', this.boundMouseUp);
      }
    }
    if (this.boundKeyDown) {
      window.removeEventListener('keydown', this.boundKeyDown);
    }
    if (this.boundKeyUp) {
      window.removeEventListener('keyup', this.boundKeyUp);
    }
    if (this.boundResize) {
      window.removeEventListener('resize', this.boundResize);
    }

    this.$destroy.next();
    this.$destroy.complete();
  }

  addEmitter() {
    if (!this.preObjectPosition || !this.scene || !this.preObjectMesh) {
      return;
    }
    const id = this.getNewObjectId();

    const emitter: EmitterData = {
      id,
      position: {
        x: this.preObjectPosition.x,
        y: MinEmitterHeightMeters,
        z: this.preObjectPosition.z,
      },
      audioFileUri: null,
    };
    this._internalScenario.emitters.push(emitter);

    const designedEmitter = createEmitterDisplay(emitter);

    this.scene.add(designedEmitter.displayMesh);
    this.emitterDisplays.set(id, designedEmitter);

    this.scene.remove(this.preObjectMesh);
    this.preObjectMesh = null;
    this.preObjectPosition = null;
  }

  addListener() {
    if (!this.preObjectPosition || !this.scene || !this.preObjectMesh) {
      return;
    }
    const id = this.getNewObjectId();

    const listener: ListenerData = {
      id,
      position: {
        x: this.preObjectPosition.x,
        y: 0,
        z: this.preObjectPosition.z,
      },
    };
    this._internalScenario.listeners.push(listener);

    const designedListener = createListenerDisplay(listener);

    this.scene.add(designedListener.displayMesh);
    this.listenerDisplays.set(id, designedListener);

    this.scene.remove(this.preObjectMesh);
    this.preObjectMesh = null;
    this.preObjectPosition = null;
  }

  onAudioSelected(event: Event, emitter: EmitterData) {
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
        emitter.audioFileUri = result.uri;
      },
      error: (err) => {
        console.error('Upload failed', err);
        alert('File upload failed');
      },
    });
  }

  deleteSelected() {
    if (!this.selectedObject || !this.scene) {
      return;
    }

    const { displayMesh, type, data } = this.selectedObject;

    if (type === 'emitter') {
      this.scene.remove(displayMesh);
      this.emitterDisplays.delete(data.id);
      this._internalScenario.emitters = this._internalScenario.emitters.filter(
        (e) => e.id !== data.id,
      );
    } else {
      this.scene.remove(displayMesh);
      this.listenerDisplays.delete(data.id);
      this._internalScenario.listeners = this._internalScenario.listeners.filter(
        (l) => l.id !== data.id,
      );
    }

    this.selectedObject = null;
  }

  private updateCameraLook() {
    if (!this.camera) {
      return;
    }
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  private getForwardVector(): THREE.Vector3 {
    if (!this.camera) {
      return new THREE.Vector3(1, 0, 0);
    }
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return dir.normalize();
  }

  private getRightVector(): THREE.Vector3 {
    if (!this.camera) {
      return new THREE.Vector3(1, 0, 0);
    }
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
    return right.normalize();
  }

  private onMouseDown(event: MouseEvent) {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    this.isDragging = false;
    this.isMouseDown = true;
    this.dragStart = { x: event.clientX, y: event.clientY };
  }

  private onMouseMove(event: MouseEvent) {
    if (!this.isMouseDown || this.mouseLeftCanvas || !this.camera) {
      return;
    }

    const deltaX = event.clientX - this.dragStart.x;
    const deltaY = event.clientY - this.dragStart.y;

    if (
      !this.isDragging &&
      (Math.abs(deltaX) > this.dragThreshold || Math.abs(deltaY) > this.dragThreshold)
    ) {
      this.isDragging = true;
    }

    if (this.isDragging) {
      this.yaw -= deltaX * this.lookSensitivity;
      this.pitch -= deltaY * this.lookSensitivity;

      const maxPitch = Math.PI / 2 - 0.05;
      const minPitch = -Math.PI / 2 + 0.05;
      this.pitch = Math.max(minPitch, Math.min(maxPitch, this.pitch));
      this.updateCameraLook();
      this.dragStart = { x: event.clientX, y: event.clientY };
    }
  }

  private onMouseUp(event?: MouseEvent) {
    if (event) event.preventDefault();
    if (!this.isDragging && this.isMouseDown && !this.mouseLeftCanvas && event) {
      if (this.editMode) {
        this.moveEditedObjectOnClick(event);
      } else {
        const clickedOnObject = this.handleObjectSelection(event);
        if (!clickedOnObject) this.handleGroundClick(event);
      }
    }
    this.isMouseDown = false;
    this.isDragging = false;
    this.mouseLeftCanvas = false;
  }

  private onMouseLeave(_: MouseEvent) {
    if (this.isMouseDown) {
      this.mouseLeftCanvas = true;
    }
  }

  private onMouseEnter(_: MouseEvent) {
    this.mouseLeftCanvas = false;
  }

  private onKeyDown(e: KeyboardEvent) {
    switch (e.code) {
      case 'KeyW':
        this.moveForward = true;
        break;
      case 'KeyS':
        this.moveBackward = true;
        break;
      case 'KeyA':
        this.moveLeft = true;
        break;
      case 'KeyD':
        this.moveRight = true;
        break;
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    switch (e.code) {
      case 'KeyW':
        this.moveForward = false;
        break;
      case 'KeyS':
        this.moveBackward = false;
        break;
      case 'KeyA':
        this.moveLeft = false;
        break;
      case 'KeyD':
        this.moveRight = false;
        break;
    }
  }

  private moveEditedObjectOnClick(event: MouseEvent) {
    if (!this.editClone || !this.camera || !this.ground) return;

    const normalizedMouse = this.getNormalizedMouse(event);
    this.raycaster.setFromCamera(normalizedMouse, this.camera);

    const intersects = this.raycaster.intersectObject(this.ground, false);
    if (intersects.length === 0) return;

    const point = intersects[0].point;
    const d = this.editClone.data;
    d.position.x = point.x;
    d.position.z = point.z;
    this.editClone.displayMesh.position.set(point.x, d.position.y, point.z);
  }

  private getNormalizedMouse(event: MouseEvent) {
    if (!this.canvasRef) {
      return new THREE.Vector2(0, 0);
    }
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  private highlightSelectedObject(obj: DesignedObject) {
    highlightDesignedObject(obj);
  }

  private clearSelectedObject() {
    if (!this.selectedObject) {
      return;
    }

    const obj = this.selectedObject;
    restoreDefaultColors(obj);
    this.selectedObject = null;
  }

  private handleObjectSelection(event: MouseEvent): boolean {
    if (!this.camera || !this.scene || this.editMode) return false;

    const normalizedMouse = this.getNormalizedMouse(event);
    this.raycaster.setFromCamera(normalizedMouse, this.camera);

    const allMeshes = [
      ...Array.from(this.emitterDisplays.values()).flatMap(getClickableParts),
      ...Array.from(this.listenerDisplays.values()).flatMap(getClickableParts),
    ];

    const intersects = this.raycaster.intersectObjects(allMeshes);
    if (intersects.length === 0) {
      this.clearSelectedObject();
      return false;
    }

    intersects.sort((a, b) => a.distance - b.distance);
    const mesh = intersects[0].object as THREE.Mesh;
    const found = mesh.userData['designedObject'] as DesignedObject | undefined;

    if (found) {
      this.clearSelectedObject();
      this.highlightSelectedObject(found);
      this.selectedObject = found;
      return true;
    }

    this.clearSelectedObject();
    return false;
  }

  private handleGroundClick(event: MouseEvent) {
    if (!this.camera || !this.scene || !this.ground || !this.canvasRef) {
      return;
    }
    if (this.editMode) {
      return;
    }

    const normalizedMouse = this.getNormalizedMouse(event);
    this.raycaster.setFromCamera(normalizedMouse, this.camera);
    const groundIntersect = this.raycaster.intersectObject(this.ground);

    if (groundIntersect.length > 0) {
      const point = groundIntersect[0].point.clone();

      point.y = 0;
      this.preObjectPosition = point.clone();

      if (this.preObjectMesh && this.scene) {
        this.scene.remove(this.preObjectMesh);
      }

      const geom = new THREE.SphereGeometry(0.35, 24, 24);
      const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 });
      this.preObjectMesh = new THREE.Mesh(geom, mat);
      this.preObjectMesh.position.copy(point);
      this.scene.add(this.preObjectMesh);
    }
  }

  private animate = () => {
    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }
    requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    const moveVector = new THREE.Vector3();

    const forward = this.getForwardVector();
    const right = this.getRightVector();

    if (this.moveForward) {
      moveVector.add(forward);
    }
    if (this.moveBackward) {
      moveVector.sub(forward);
    }
    if (this.moveRight) {
      moveVector.add(right);
    }
    if (this.moveLeft) {
      moveVector.sub(right);
    }

    if (moveVector.lengthSq() > 0.000001) {
      moveVector.normalize().multiplyScalar(this.moveSpeed * delta);
      this.camera.position.add(moveVector);
    }

    this.clampCameraToGround();
    this.renderer.render(this.scene, this.camera);
  };

  private onResize() {
    if (!this.camera || !this.renderer || !this.canvasRef) {
      return;
    }
    const canvas = this.canvasRef.nativeElement;
    this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  }

  public getScenario(): ScenarioData {
    this._internalScenario.name = this.form.controls.name.value || '';
    return { ...this._internalScenario };
  }

  private clampCameraToGround(): void {
    if (!this.camera) return;

    const groundY = this.ground?.position.y ?? 0;
    const minHeight = groundY + 0.5;

    if (this.camera.position.y < minHeight) {
      this.camera.position.y = minHeight;
    }
  }

  private getNewObjectId() {
    return this._idCounter++;
  }

  enterEditMode() {
    if (!this.selectedObject || !this.scene) {
      return;
    }
    if (this.editMode) {
      return;
    }

    if (this.preObjectPosition && this.preObjectMesh) {
      this.scene.remove(this.preObjectMesh);
      this.preObjectMesh = null;
      this.preObjectPosition = null;
    }

    const original = this.selectedObject;
    this.editingOriginal = original;
    this.editMode = true;

    this.setDesignedObjectVisibility(original, false);

    const clone = this.cloneDesignedObject(original);
    this.editClone = clone;

    this.scene.add(clone.displayMesh);

    const height = original.data.position.y;
    const rotationDeg =
      original.type === 'listener' ? THREE.MathUtils.radToDeg(clone.displayMesh.rotation.y) : 0;

    const formConfig: any = { height: new FormControl<number>(height, { nonNullable: true }) };
    if (original.type === 'listener') {
      formConfig.rotation = new FormControl<number>(rotationDeg, { nonNullable: true });
    }

    this.editForm = new FormGroup(formConfig);

    this.editFormSub = this.editForm.valueChanges.pipe(debounceTime(100)).subscribe((values) => {
      if (!this.editClone) return;
      const d = this.editClone;
      if (typeof values.height === 'number') {
        d.data.position.y = values.height;
        d.displayMesh.position.y = values.height;
      }
      if (d.type === 'listener' && typeof values.rotation === 'number') {
        const rotRad = THREE.MathUtils.degToRad(values.rotation);
        d.displayMesh.rotation.y = rotRad;
      }
    });
  }

  exitEditMode(save = false) {
    if (!this.editMode || !this.editingOriginal) return;

    const original = this.editingOriginal;
    const clone = this.editClone;

    if (this.scene && clone) {
      this.scene.remove(clone.displayMesh);
    }

    if (save && clone && this.scene) {
      this.scene.remove(original.displayMesh);

      if (clone.type !== original.type) {
        console.error('Edited object and clone object have different types');
        return;
      }

      if (clone.type === 'emitter') {
        this._internalScenario.emitters = this._internalScenario.emitters.filter(
          (e) => e.id !== original.data.id,
        );
        this.emitterDisplays.delete(original.data.id);

        const recreated = createEmitterDisplay(structuredClone(clone.data));
        this._internalScenario.emitters.push(recreated.data);
        this.emitterDisplays.set(recreated.data.id, recreated);
        this.scene.add(recreated.displayMesh);
        this.selectedObject = recreated;
      } else {
        this._internalScenario.listeners = this._internalScenario.listeners.filter(
          (l) => l.id !== original.data.id,
        );
        this.listenerDisplays.delete(original.data.id);

        const recreated = createListenerDisplay(structuredClone(clone.data));
        this._internalScenario.listeners.push(recreated.data);
        this.listenerDisplays.set(recreated.data.id, recreated);
        this.scene.add(recreated.displayMesh);
        this.selectedObject = recreated;
      }
    } else {
      this.setDesignedObjectVisibility(original, true);
      this.selectedObject = original;
    }

    this.editMode = false;
    this.editingOriginal = null;
    this.editClone = null;
    this.editFormSub?.unsubscribe();
    this.editForm = null;
  }

  private setDesignedObjectVisibility(obj: DesignedObject, visible: boolean) {
    for (const mesh of this.getAllMeshes(obj)) {
      mesh.visible = visible;
    }
  }

  private getAllMeshes(obj: DesignedObject): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    for (const key in obj.display) {
      const value = (obj.display as any)[key];
      if (value instanceof THREE.Mesh) meshes.push(value);
    }
    return meshes;
  }

  private cloneDesignedObject(obj: DesignedObject): DesignedObject {
    if (obj.type === 'emitter') {
      const emitter = createEmitterDisplay(structuredClone(obj.data));
      markObjectAsEdited(emitter);
      return emitter;
    } else {
      const listener = createListenerDisplay(structuredClone(obj.data));
      markObjectAsEdited(listener);
      return listener;
    }
  }
}
