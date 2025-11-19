import {
  DesignedEmitter,
  DesignedListener,
  DesignedObject,
  EMITTER_FUSELAGE_COLOR,
  EMITTER_HIGHLIGHT,
  EMITTER_NOSE_COLOR,
  EMITTER_TAIL_HOR_COLOR,
  EMITTER_TAIL_VER_COLOR,
  EMITTER_WINGS_COLOR,
  LISTENER_BASE_COLOR,
  LISTENER_COLOR,
  LISTENER_HIGHLIGHT,
  LISTENER_POLE_COLOR,
} from '@models/designer/designer.model';
import { EmitterData, ListenerData } from '@models/scenario/list-scenario-data.model';
import {
  ListenerConeAngleDeg,
  ListenerConeHeightMeters,
  MinEmitterHeightMeters,
  MinListenerHeightMeters,
} from 'core/const/scenario.const';
import * as THREE from 'three';

export function createEmitterDisplay(emitterData: EmitterData) {
  const group = new THREE.Group();

  const fuselage = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.6, 16),
    new THREE.MeshBasicMaterial({ color: EMITTER_FUSELAGE_COLOR }),
  );
  fuselage.rotation.z = Math.PI / 2;
  group.add(fuselage);

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.1, 16),
    new THREE.MeshBasicMaterial({ color: EMITTER_NOSE_COLOR }),
  );
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 0.35;
  group.add(nose);

  const wings = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.02, 0.15),
    new THREE.MeshBasicMaterial({ color: EMITTER_WINGS_COLOR }),
  );

  const wingSpan = 0.3;
  const wingThickness = 0.02;
  const wingChord = 0.15;
  wings.geometry = new THREE.BoxGeometry(wingChord, wingThickness, wingSpan);
  wings.position.set(0, 0, 0);
  group.add(wings);

  const tailHor = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.02, 0.15),
    new THREE.MeshBasicMaterial({ color: EMITTER_TAIL_HOR_COLOR }),
  );
  tailHor.position.set(-0.3, 0, 0);
  group.add(tailHor);

  const tailVer = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.1, 0.05),
    new THREE.MeshBasicMaterial({ color: EMITTER_TAIL_VER_COLOR }),
  );
  tailVer.position.set(-0.3, 0.05, 0);
  group.add(tailVer);

  // FIX: Use startPoint instead of position
  group.position.set(
    emitterData.startPoint.x,
    emitterData.startPoint.y,
    emitterData.startPoint.z,
  );

  const designedEmitter: DesignedEmitter = {
    type: 'emitter',
    data: emitterData,
    displayMesh: group,
    display: {
      fuselage,
      wings,
      tailHor,
      tailVer,
      nose,
    },
  };

  Object.values(designedEmitter.display).forEach((mesh) => {
    if (mesh instanceof THREE.Mesh) {
      mesh.userData['designedObject'] = designedEmitter;
    }
  });

  return designedEmitter;
}

export function createListenerDisplay(listenerData: ListenerData) {
  const group = new THREE.Group();

  const baseHeight = 0.1;
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, baseHeight, 16),
    new THREE.MeshBasicMaterial({ color: LISTENER_BASE_COLOR }),
  );
  base.position.y = baseHeight / 2;
  group.add(base);

  const poleHeight = listenerData.position.y;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, poleHeight, 16),
    new THREE.MeshBasicMaterial({ color: LISTENER_POLE_COLOR }),
  );
  pole.position.y = poleHeight / 2;
  group.add(pole);

  const rail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.4, 16),
    new THREE.MeshBasicMaterial({ color: LISTENER_COLOR }),
  );
  rail.rotation.z = Math.PI / 2;
  rail.position.y = poleHeight;
  group.add(rail);

  const micGeom = new THREE.SphereGeometry(0.05, 16, 16);
  const micLeft = new THREE.Mesh(micGeom, new THREE.MeshBasicMaterial({ color: LISTENER_COLOR }));
  const micRight = new THREE.Mesh(micGeom, new THREE.MeshBasicMaterial({ color: LISTENER_COLOR }));
  micLeft.position.set(-0.2, poleHeight, 0);
  micRight.position.set(0.2, poleHeight, 0);
  group.add(micLeft, micRight);

  const coneMaterial = new THREE.MeshBasicMaterial({
    color: LISTENER_COLOR,
    transparent: true,
    opacity: 0.03,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const coneHeight = ListenerConeHeightMeters;
  const coneRadius = coneHeight * Math.tan(((ListenerConeAngleDeg / 2) * Math.PI) / 180);
  const coneGeom = new THREE.ConeGeometry(coneRadius, coneHeight, 16, 1, true);

  const coneLeft = new THREE.Mesh(coneGeom, coneMaterial.clone());
  coneLeft.rotation.x = Math.PI / 2;
  coneLeft.position.copy(micLeft.position);
  coneLeft.position.z -= coneHeight / 2;
  group.add(coneLeft);

  const coneRight = new THREE.Mesh(coneGeom, coneMaterial.clone());
  coneRight.rotation.x = Math.PI / 2;
  coneRight.position.copy(micRight.position);
  coneRight.position.z -= coneHeight / 2;
  group.add(coneRight);

  group.position.set(listenerData.position.x, 0, listenerData.position.z);

  group.rotation.y = THREE.MathUtils.degToRad(listenerData.rotation);

  const designedListener: DesignedListener = {
    type: 'listener',
    data: listenerData,
    displayMesh: group,
    display: {
      base,
      pole,
      rail,
      micLeft,
      micRight,
      coneLeft,
      coneRight,
    },
  };

  Object.values(designedListener.display).forEach((mesh) => {
    if (mesh instanceof THREE.Mesh) {
      mesh.userData['designedObject'] = designedListener;
    }
  });

  hideListenerCones(designedListener);

  return designedListener;
}

export function markObjectAsEdited(obj: DesignedObject): void {
  const meshes = Object.values(obj.display);

  const coneMeshes = obj.type === 'listener' ? [obj.display.coneLeft, obj.display.coneRight] : [];

  for (const mesh of meshes) {
    if (!(mesh instanceof THREE.Mesh)) continue;

    if (coneMeshes.includes(mesh)) {
      continue;
    }

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    const newMaterials = materials.map((mat) => {
      if (!(mat instanceof THREE.Material)) return mat;

      const m = mat.clone();
      (m as any).transparent = true;
      (m as any).opacity = 0.6;
      (m as any).depthWrite = true;

      return m;
    });

    mesh.material = Array.isArray(mesh.material) ? newMaterials : newMaterials[0];
  }
}

export function highlightDesignedObject(designedObject: DesignedObject) {
  if (designedObject.type === 'emitter') {
    const d = designedObject.display;
    [d.fuselage, d.wings, d.tailVer, d.tailHor, d.nose].forEach((m) =>
      (m.material as THREE.MeshBasicMaterial).color.setHex(EMITTER_HIGHLIGHT),
    );
  } else {
    const d = designedObject.display;
    [d.base, d.pole, d.rail, d.micLeft, d.micRight].forEach((m) =>
      (m.material as THREE.MeshBasicMaterial).color.setHex(LISTENER_HIGHLIGHT),
    );
  }
}

export function restoreDefaultColors(designedObject: DesignedObject) {
  if (designedObject.type === 'emitter') {
    const d = designedObject.display;
    (
      [
        [d.fuselage, EMITTER_FUSELAGE_COLOR],
        [d.wings, EMITTER_WINGS_COLOR],
        [d.tailVer, EMITTER_TAIL_VER_COLOR],
        [d.tailHor, EMITTER_TAIL_HOR_COLOR],
        [d.nose, EMITTER_NOSE_COLOR],
      ] as [THREE.Mesh, number][]
    ).forEach(([m, color]) => (m.material as THREE.MeshBasicMaterial).color.setHex(color));
  } else {
    const d = designedObject.display;
    (
      [
        [d.base, LISTENER_BASE_COLOR],
        [d.pole, LISTENER_POLE_COLOR],
        [d.rail, LISTENER_COLOR],
        [d.micLeft, LISTENER_COLOR],
        [d.micRight, LISTENER_COLOR],
      ] as [THREE.Mesh, number][]
    ).forEach(([m, color]) => (m.material as THREE.MeshBasicMaterial).color.setHex(color));
  }
}

export function getClickableParts(designedObject: DesignedObject) {
  if (designedObject.type === 'emitter') {
    const d = designedObject.display;
    return [d.fuselage, d.wings, d.tailVer, d.tailHor, d.nose];
  } else {
    const d = designedObject.display;
    return [d.base, d.pole, d.rail, d.micLeft, d.micRight];
  }
}

export function updateDesignedObjectTransform(
  obj: DesignedObject,
  changes: Partial<{ height: number; rotation: number; audioFileUri: string }>,
): void {
  if (obj.type === 'emitter') {
    updateEmitterTransform(obj, changes);
  } else {
    updateListenerTransform(obj, changes);
  }
}

export function showListenerCones(listener: DesignedListener) {
  listener.display.coneLeft.visible = true;
  listener.display.coneRight.visible = true;
}

export function hideListenerCones(listener: DesignedListener) {
  listener.display.coneLeft.visible = false;
  listener.display.coneRight.visible = false;
}

function updateEmitterTransform(
  emitter: DesignedEmitter,
  changes: Partial<{ height: number; audioFileUri: string }>,
): void {
  const { height, audioFileUri } = changes;

  if (typeof height === 'number' && height >= MinEmitterHeightMeters) {
    // FIX: Update startPoint instead of position
    emitter.data.startPoint.y = height;
    emitter.displayMesh.position.y = height;
  }

  if (typeof audioFileUri === 'string') {
    emitter.data.audioFileUri = audioFileUri;
  }
}

function updateListenerTransform(
  listener: DesignedListener,
  changes: Partial<{ height: number; rotation: number }>,
): void {
  const { height, rotation } = changes;
  const d = listener.display;

  if (typeof height === 'number' && height >= MinListenerHeightMeters) {
    listener.data.position.y = height;

    d.pole.geometry.dispose();
    d.pole.geometry = new THREE.CylinderGeometry(0.03, 0.03, height, 16);
    d.pole.position.y = height / 2;

    d.rail.position.y = height;
    d.micLeft.position.y = height;
    d.micRight.position.y = height;

    const coneHeight = ListenerConeHeightMeters;
    d.coneLeft.position.y = height;
    d.coneLeft.position.z = d.micLeft.position.z - coneHeight / 2;
    d.coneRight.position.y = height;
    d.coneRight.position.z = d.micRight.position.z - coneHeight / 2;
  }

  if (typeof rotation === 'number') {
    const normalized = ((rotation % 360) + 360) % 360;
    listener.displayMesh.rotation.y = THREE.MathUtils.degToRad(normalized);
    listener.data.rotation = normalized;
  }
}
