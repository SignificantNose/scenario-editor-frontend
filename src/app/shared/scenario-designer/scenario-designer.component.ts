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
import {
  ScenarioData,
  EmitterData,
  ListenerData,
  PositionData,
} from '@models/scenario/list-scenario-data.model';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  AtmosphericPressureMax,
  AtmosphericPressureMin,
  EtalonAtmosphericPressurePa,
  EtalonTemperatureCelsius,
  HumidityPercentMax,
  HumidityPercentMin,
  ScenarioNameRegex,
  TemperatureCelsiusMax,
  TemperatureCelsiusMin,
} from 'app/const/app.defaults';
import { Subject, takeUntil } from 'rxjs';
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
  hideListenerCones,
  highlightDesignedObject,
  markObjectAsEdited,
  restoreDefaultColors,
  showListenerCones,
  updateDesignedObjectTransform,
} from 'core/utils/designer-object-creator.util';
import { MinEmitterHeightMeters, MinListenerHeightMeters } from 'core/const/scenario.const';
import {
  EmitterEditorComponent,
  EmitterEditTarget,
} from './components/emitter-editor/emitter-editor.component';
import { ListenerEditorComponent } from './components/listener-editor/listener-editor.component';
import { DesignedObjectInfoComponent } from './components/designed-object-info/designed-object-info.component';
import { minLessThanMaxValidator } from 'core/validators/min-less-than-max.validator';
import { minLessThanOrEqualToMaxValidator } from 'core/validators/min-less-than-or-equal-to-max.validator';

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
    EmitterEditorComponent,
    ListenerEditorComponent,
    DesignedObjectInfoComponent,
  ],
  standalone: true,
})
export class ScenarioDesignerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: false })
  canvasRef: ElementRef<HTMLCanvasElement> | null = null;

  temperatureCelsiusMin = TemperatureCelsiusMin;
  temperatureCelsiusMax = TemperatureCelsiusMax;
  humidityPercentMin = HumidityPercentMin;
  humidityPercentMax = HumidityPercentMax;
  atmosphericPressureMin = AtmosphericPressureMin;
  atmosphericPressureMax = AtmosphericPressureMax;

  form = new FormGroup(
    {
      name: new FormControl<string | null>(null, {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(ScenarioNameRegex)],
      }),
      temperatureCelsius: new FormControl<number | null>(null, {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.min(this.temperatureCelsiusMin),
          Validators.max(this.temperatureCelsiusMax),
        ],
      }),
      humidityPercent: new FormControl<number | null>(null, {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.min(this.humidityPercentMin),
          Validators.max(this.humidityPercentMax),
        ],
      }),
      atmosphericPressurePa: new FormControl<number | null>(null, {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.min(this.atmosphericPressureMin),
          Validators.max(this.atmosphericPressureMax),
        ],
      }),
      scenarioStartTime: new FormControl<number | null>(null, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(0)],
      }),
      scenarioEndTime: new FormControl<number | null>(null, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(0)],
      }),
    },
    { validators: [minLessThanOrEqualToMaxValidator('scenarioStartTime', 'scenarioEndTime')] },
  );

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
    if (value) {
      this._scenario = structuredClone(value);
      this._internalScenario = structuredClone(value);

      const allIds = [
        ...this._internalScenario.emitters.map((e) => e.id),
        ...this._internalScenario.listeners.map((l) => l.id),
      ];
      this._idCounter = allIds.length ? Math.max(...allIds) + 1 : 0;

      this.form.patchValue({
        name: value.name,
        temperatureCelsius: (value as any).temperatureCelsius ?? 20,
        humidityPercent: (value as any).humidityPercent ?? 50,
        atmosphericPressurePa: (value as any).atmosphericPressurePa ?? 101325,
        scenarioStartTime: (value as any).scenarioStartTime ?? 0,
        scenarioEndTime: (value as any).scenarioEndTime ?? 60,
      });

      setTimeout(() => {
        console.log(this._internalScenario.emitters);
        this._internalScenario.emitters.forEach((e) => this.addExistingEmitter(e));
        this._internalScenario.listeners.forEach((l) => this.addExistingListener(l));
      });
    }
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
  preObjectPosition: THREE.Vector3 | null = null;

  private _internalScenario: ScenarioData = {
    id: 0,
    name: 'New Scenario',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    emitters: [],
    listeners: [],
    temperatureCelsius: EtalonTemperatureCelsius,
    atmosphericPressurePa: EtalonAtmosphericPressurePa,
    humidityPercent: 50,
    scenarioStartTime: 0,
    scenarioEndTime: 10,
  };

  private emitterDisplays: Map<number, DesignedEmitter> = new Map();
  private listenerDisplays: Map<number, DesignedListener> = new Map();

  private _idCounter = 0;

  editMode = false;
  private activeEditTarget: EmitterEditTarget = 'start';
  private trajectoryLines: Map<number, THREE.Line> = new Map();

  constructor(private ngZone: NgZone) { }

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
      audioFileUri: null,
      startPoint: {
        x: this.preObjectPosition.x,
        y: MinEmitterHeightMeters,
        z: this.preObjectPosition.z,
      },
      startTime: 0,
      endPoint: null,
      endTime: null,
    };
    this._internalScenario.emitters.push(emitter);

    const designedEmitter = createEmitterDisplay(emitter);

    this.scene.add(designedEmitter.displayMesh);
    this.emitterDisplays.set(id, designedEmitter);

    this.updateEmitterVisuals(designedEmitter);

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
        y: MinListenerHeightMeters,
        z: this.preObjectPosition.z,
      },
      rotation: 0,
    };
    this._internalScenario.listeners.push(listener);

    const designedListener = createListenerDisplay(listener);

    this.scene.add(designedListener.displayMesh);
    this.listenerDisplays.set(id, designedListener);

    this.scene.remove(this.preObjectMesh);
    this.preObjectMesh = null;
    this.preObjectPosition = null;
  }

  deleteSelected() {
    if (!this.selectedObject || !this.scene) {
      return;
    }

    const { displayMesh, type, data } = this.selectedObject;

    this.scene.remove(displayMesh);
    if (type === 'emitter') {
      this.emitterDisplays.delete(data.id);
      this._internalScenario.emitters = this._internalScenario.emitters.filter(
        (e) => e.id !== data.id,
      );

      this.removeTrajectoryLine(data.id);
    } else {
      this.listenerDisplays.delete(data.id);
      this._internalScenario.listeners = this._internalScenario.listeners.filter(
        (l) => l.id !== data.id,
      );
    }

    this.selectedObject = null;
  }

  onEditTargetChanged(target: EmitterEditTarget) {
    this.activeEditTarget = target;

    if (this.selectedObject) {
      this.updateEmitterVisuals(this.selectedObject);
    }
  }

  private updateEmitterVisuals(obj: DesignedObject) {
    if (obj.type !== 'emitter' || !this.scene) return;

    const data = obj.data as EmitterData;

    this.updateEmitterRotation(obj.displayMesh, data.startPoint, data.endPoint);
    this.updateTrajectoryLine(data);
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
    if (event) {
      event.preventDefault();
    }
    if (!this.isDragging && this.isMouseDown && !this.mouseLeftCanvas && event) {
      if (this.editMode && this.selectedObject) {
        this.moveEditedObjectOnClick(event);
      } else {
        const clickedOnObject = this.handleObjectSelection(event);
        if (!clickedOnObject) {
          this.handleGroundClick(event);
        }
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

  private updateEmitterRotation(
    mesh: THREE.Object3D,
    start: PositionData,
    end: PositionData | null,
  ) {
    if (!end) {
      mesh.rotation.set(0, 0, 0);
      return;
    }

    const startVec = new THREE.Vector3(start.x, start.y, start.z);
    const endVec = new THREE.Vector3(end.x, end.y, end.z);

    if (startVec.distanceToSquared(endVec) < 0.0001) return;

    mesh.lookAt(endVec);
    mesh.rotateY(-Math.PI / 2);
  }

  private moveEditedObjectOnClick(event: MouseEvent) {
    if (!this.selectedObject || !this.camera || !this.ground) {
      return;
    }

    const normalizedMouse = this.getNormalizedMouse(event);
    this.raycaster.setFromCamera(normalizedMouse, this.camera);

    const intersects = this.raycaster.intersectObject(this.ground, false);
    if (intersects.length === 0) return;

    const point = intersects[0].point;

    if (this.selectedObject.type === 'emitter') {
      const data = this.selectedObject.data as EmitterData;

      if (this.activeEditTarget === 'start') {
        data.startPoint.x = point.x;
        data.startPoint.z = point.z;
        this.selectedObject.displayMesh.position.setX(point.x);
        this.selectedObject.displayMesh.position.setZ(point.z);
      } else {
        if (!data.endPoint) {
          data.endPoint = { ...data.startPoint };
        }
        data.endPoint.x = point.x;
        data.endPoint.z = point.z;
      }

      this.updateEmitterVisuals(this.selectedObject);
    } else {
      this.selectedObject.data.position.x = point.x;
      this.selectedObject.data.position.z = point.z;
      this.selectedObject.displayMesh.position.setX(point.x);
      this.selectedObject.displayMesh.position.setZ(point.z);
    }
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

    if (obj.type === 'listener') {
      hideListenerCones(obj);
    }
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

      if (found.type === 'listener') {
        showListenerCones(found);
      }
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
    const {
      name,
      temperatureCelsius,
      humidityPercent,
      atmosphericPressurePa,
      scenarioStartTime,
      scenarioEndTime,
    } = this.form.value;
    this._internalScenario.name = name ?? '';
    this._internalScenario.temperatureCelsius = temperatureCelsius ?? 0;
    this._internalScenario.humidityPercent = humidityPercent ?? 0;
    this._internalScenario.atmosphericPressurePa = atmosphericPressurePa ?? 0;
    this._internalScenario.scenarioStartTime = scenarioStartTime ?? 0;
    this._internalScenario.scenarioEndTime = scenarioEndTime ?? 0;
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
    if (!this.selectedObject || this.editMode || !this.scene) {
      return;
    }

    this.editMode = true;

    if (this.preObjectMesh && this.preObjectPosition) {
      this.scene.remove(this.preObjectMesh);
      this.preObjectMesh = null;
      this.preObjectPosition = null;
    }

    this.scene.remove(this.selectedObject.displayMesh);
    const clone = this.cloneDesignedObject(this.selectedObject);
    this.selectedObject = clone;

    if (clone.type == 'listener') {
      showListenerCones(clone);
    }
    this.scene.add(clone.displayMesh);

    this.activeEditTarget = 'start';
    this.updateEmitterVisuals(clone);
  }

  onEditorSave(editedData: EmitterData | ListenerData) {
    if (!this.selectedObject || !this.scene) {
      return;
    }

    this.scene.remove(this.selectedObject.displayMesh);

    if (this.selectedObject.type === 'emitter') {
      const originalEmitterIndex = this._internalScenario.emitters.findIndex(
        (e) => e.id === editedData.id,
      );
      if (originalEmitterIndex !== -1) {
        this._internalScenario.emitters[originalEmitterIndex] = editedData as EmitterData;
      }
      this.emitterDisplays.delete(editedData.id);
      const recreated = createEmitterDisplay(editedData as EmitterData);
      this.emitterDisplays.set(recreated.data.id, recreated);
      this.scene.add(recreated.displayMesh);

      this.updateEmitterVisuals(recreated);
      this.selectedObject = null;
    } else {
      const originalListenerIndex = this._internalScenario.listeners.findIndex(
        (l) => l.id === editedData.id,
      );
      if (originalListenerIndex !== -1) {
        this._internalScenario.listeners[originalListenerIndex] = editedData as ListenerData;
      }
      this.listenerDisplays.delete(editedData.id);
      const recreated = createListenerDisplay(editedData as ListenerData);
      this.listenerDisplays.set(recreated.data.id, recreated);
      this.scene.add(recreated.displayMesh);
      this.selectedObject = null;
    }

    this.exitEditMode();
  }

  onEditorCancel() {
    const editedClone = this.selectedObject;
    if (!editedClone || !this.scene) {
      return;
    }

    let recreated: DesignedObject | undefined;
    if (editedClone.type === 'emitter') {
      const originalEmitter = this._internalScenario.emitters.find(
        (e) => e.id === editedClone.data.id,
      );
      if (!originalEmitter) {
        return;
      }
      recreated = createEmitterDisplay(originalEmitter);
      this.emitterDisplays.set(recreated.data.id, recreated);
      this.updateEmitterVisuals(recreated);
    } else {
      const originalListener = this._internalScenario.listeners.find(
        (l) => l.id === editedClone.data.id,
      );
      if (!originalListener) {
        return;
      }
      recreated = createListenerDisplay(originalListener);
      this.listenerDisplays.set(recreated.data.id, recreated);
    }

    this.scene.add(recreated.displayMesh);
    this.selectedObject = null;

    this.scene.remove(editedClone.displayMesh);
    this.exitEditMode();
  }

  onObjectTransformChanged() {
    if (this.selectedObject && this.selectedObject.type === 'emitter') {
      const data = this.selectedObject.data as EmitterData;
      this.selectedObject.displayMesh.position.setY(data.startPoint.y);
      this.updateEmitterVisuals(this.selectedObject);
    }
  }

  private updateTrajectoryLine(data: EmitterData) {
    if (!this.scene) return;
    const lineId = data.id;
    let line = this.trajectoryLines.get(lineId);

    if (!data.endPoint) {
      this.removeTrajectoryLine(lineId);
      return;
    }

    const startVec = new THREE.Vector3(data.startPoint.x, data.startPoint.y, data.startPoint.z);
    const endVec = new THREE.Vector3(data.endPoint.x, data.endPoint.y, data.endPoint.z);

    if (!line) {
      const geometry = new THREE.BufferGeometry().setFromPoints([startVec, endVec]);

      const material = new THREE.LineDashedMaterial({
        color: 0x0000ff,
        linewidth: 1,
        scale: 1,
        dashSize: 0.5,
        gapSize: 0.2,
        transparent: true,
        opacity: 0.5,
        depthTest: false, // Always visible
      });

      line = new THREE.Line(geometry, material);
      line.frustumCulled = false; // Prevent disappearing
      line.renderOrder = 999; // Render on top/through
      line.computeLineDistances(); // Required for dashes

      this.scene.add(line);
      this.trajectoryLines.set(lineId, line);
    } else {
      line.geometry.setFromPoints([startVec, endVec]);
      line.computeLineDistances();
      line.geometry.attributes['position'].needsUpdate = true;
    }
  }

  private removeTrajectoryLine(id: number) {
    const line = this.trajectoryLines.get(id);
    if (line && this.scene) {
      this.scene.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
      this.trajectoryLines.delete(id);
    }
  }

  private updateTrajectoryVisuals(obj: DesignedObject) {
    if (obj.type !== 'emitter' || !this.scene) {
      return;
    }

    const data = obj.data as EmitterData;
    const lineId = data.id;
    let line = this.trajectoryLines.get(lineId);

    this.updateEmitterRotation(obj.displayMesh, data.startPoint, data.endPoint);

    if (!data.endPoint) {
      if (line) {
        this.scene.remove(line);
        if (line.geometry) {
          line.geometry.dispose();
        }
        const mat = line.material as THREE.Material;
        if (mat) {
          mat.dispose();
        }
        this.trajectoryLines.delete(lineId);
      }
      return;
    }

    const startVec = new THREE.Vector3(data.startPoint.x, data.startPoint.y, data.startPoint.z);
    const endVec = new THREE.Vector3(data.endPoint.x, data.endPoint.y, data.endPoint.z);

    if (!line) {
      const geometry = new THREE.BufferGeometry().setFromPoints([startVec, endVec]);

      const material = new THREE.LineDashedMaterial({
        color: 0x0000ff,
        linewidth: 1,
        scale: 1,
        dashSize: 0.5,
        gapSize: 0.2,
        transparent: true,
        opacity: 0.5,
        depthTest: false,
      });
      line = new THREE.Line(geometry, material);

      line.frustumCulled = false;

      line.computeLineDistances();

      line.renderOrder = 999;
      this.scene.add(line);
      this.trajectoryLines.set(lineId, line);
    } else {
      line.geometry.setFromPoints([startVec, endVec]);
      line.computeLineDistances();
      line.geometry.attributes['position'].needsUpdate = true;
    }
  }

  private exitEditMode() {
    this.editMode = false;
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

  private addExistingEmitter(emitter: EmitterData) {
    if (!this.scene) {
      return;
    }
    const designedEmitter = createEmitterDisplay(emitter);
    this.scene.add(designedEmitter.displayMesh);
    this.emitterDisplays.set(emitter.id, designedEmitter);

    this.updateEmitterVisuals(designedEmitter);
  }

  private addExistingListener(listener: ListenerData) {
    if (!this.scene) {
      return;
    }
    const designedListener = createListenerDisplay(listener);
    this.scene.add(designedListener.displayMesh);
    this.listenerDisplays.set(listener.id, designedListener);
  }
}
