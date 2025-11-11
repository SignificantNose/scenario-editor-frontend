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
import * as THREE from 'three';

export function createEmitterDisplay(emitterData: EmitterData) {
  const group = new THREE.Group();

  // Fuselage: 0.6 m long, 0.1 m diameter
  const fuselage = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.6, 16),
    new THREE.MeshBasicMaterial({ color: EMITTER_FUSELAGE_COLOR})
  );
  fuselage.rotation.z = Math.PI / 2; // Aligns along X-axis
  group.add(fuselage);

  // Nose cone: 0.1 m long, 0.05 radius
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.1, 16),
    new THREE.MeshBasicMaterial({ color: EMITTER_NOSE_COLOR })
  );
  nose.rotation.z = -Math.PI / 2; // Points along positive X-axis
  nose.position.x = 0.35; // front of fuselage
  group.add(nose);

  // Wings: 0.3 m wide, 0.02 thick, 0.15 m deep
  const wings = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.02, 0.15),
    new THREE.MeshBasicMaterial({ color: EMITTER_WINGS_COLOR })
  );
  // Initial BoxGeometry is (width, height, depth) along X, Y, Z respectively.
  // We want the 0.3 (width) to be the span along Z, 0.15 (depth) to be along X, and 0.02 (height) to be along Y (thickness).
  // No rotation is needed if we assume XZ plane for horizontal surfaces and Y for height.
  // Let's adjust dimensions to match typical (span, thickness, chord)
  const wingSpan = 0.3;
  const wingThickness = 0.02;
  const wingChord = 0.15; // Depth of the wing from front to back
  wings.geometry = new THREE.BoxGeometry(wingChord, wingThickness, wingSpan); // (X=chord, Y=thickness, Z=span)
  wings.position.set(0, 0, 0); // center on fuselage
  group.add(wings);


  // Tail horizontal stabilizer: 0.15 m wide, 0.02 thick, 0.05 m deep
  const tailHor = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.02, 0.15), // (X=chord, Y=thickness, Z=span)
    new THREE.MeshBasicMaterial({ color: EMITTER_TAIL_HOR_COLOR })
  );
  tailHor.position.set(-0.3, 0, 0); // back of fuselage
  group.add(tailHor);

  // Tail vertical fin: 0.02 thick, 0.05 m wide, 0.1 m tall
  const tailVer = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.1, 0.05), // dimensions: (X=thickness, Y=height, Z=width of fin)
    new THREE.MeshBasicMaterial({ color: EMITTER_TAIL_VER_COLOR })
  );
  tailVer.position.set(-0.3, 0.05, 0); // Position above the horizontal tail
  group.add(tailVer);

  // Removed the stand as requested
  // const stand = new THREE.Mesh(
  //   new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8),
  //   new THREE.MeshBasicMaterial({ color: EMITTER_STAND_COLOR })
  // );
  // stand.position.set(0, -0.15 - 0.05, 0);
  // group.add(stand);

  // position group at emitter position
  group.position.set(emitterData.position.x, emitterData.position.y, emitterData.position.z);

  const designedEmitter: DesignedEmitter = {
    type: 'emitter',
    data: emitterData,
    displayMesh: group,
    display: {
      fuselage,
      wings,
      tailHor, // Referencing the correct tail part
      tailVer, // Including the vertical tail
      nose,
      // stand, // Removed from display
    },
  };

  // Assign userData for selection
  Object.values(designedEmitter.display).forEach((mesh) => {
    if (mesh instanceof THREE.Mesh) {
      mesh.userData['designedObject'] = designedEmitter;
    }
  });

  return designedEmitter;
}

export function createListenerDisplay(listenerData: ListenerData) {
  const group = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16),
    new THREE.MeshBasicMaterial({ color: LISTENER_BASE_COLOR }),
  );
  base.position.y = 0.05;
  group.add(base);

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 1, 16),
    new THREE.MeshBasicMaterial({ color: LISTENER_POLE_COLOR }),
  );
  pole.position.y = 0.55;
  group.add(pole);

  const rail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.4, 16),
    new THREE.MeshBasicMaterial({ color: LISTENER_COLOR }),
  );
  rail.rotation.z = Math.PI / 2;
  rail.position.y = 1.05;
  group.add(rail);

  const micGeom = new THREE.SphereGeometry(0.05, 16, 16);
  const micLeft = new THREE.Mesh(micGeom, new THREE.MeshBasicMaterial({ color: LISTENER_COLOR }));
  const micRight = new THREE.Mesh(micGeom, new THREE.MeshBasicMaterial({ color: LISTENER_COLOR }));
  micLeft.position.set(-0.2, 1.05, 0);
  micRight.position.set(0.2, 1.05, 0);
  group.add(micLeft, micRight);

  const coneMaterial = new THREE.MeshBasicMaterial({
    color: LISTENER_COLOR,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const coneHeight = 0.6;
  const coneGeom = new THREE.ConeGeometry(0.15, coneHeight, 16, 1, true);

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

  group.position.set(listenerData.position.x, listenerData.position.y, listenerData.position.z);

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

  return designedListener;
}

export function markObjectAsEdited(obj: DesignedObject): void {
  const meshes = Object.values(obj.display);

  for (const mesh of meshes) {
    if (!(mesh instanceof THREE.Mesh)) continue;

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
