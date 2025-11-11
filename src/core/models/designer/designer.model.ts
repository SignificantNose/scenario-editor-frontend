import { EmitterData, ListenerData } from '@models/scenario/list-scenario-data.model';
import * as THREE from 'three';

export const EMITTER_HIGHLIGHT = 0x6666ff;
export const EMITTER_FUSELAGE_COLOR = 0xcccccc;
export const EMITTER_NOSE_COLOR = 0x999999;
export const EMITTER_WINGS_COLOR = 0x0077ff;
export const EMITTER_TAIL_HOR_COLOR = 0x0077ff;
export const EMITTER_TAIL_VER_COLOR = 0x0055cc;

export const LISTENER_COLOR = 0x0000ff;
export const LISTENER_BASE_COLOR = 0x333333;
export const LISTENER_POLE_COLOR = 0x555555;
export const LISTENER_HIGHLIGHT = 0x6666ff;

export interface DesignedEmitter {
  type: 'emitter';
  data: EmitterData;
  displayMesh: THREE.Object3D;
  display: {
    fuselage: THREE.Mesh;
    wings: THREE.Mesh;
    tailHor: THREE.Mesh;
    tailVer: THREE.Mesh;
    nose: THREE.Mesh;
  };
}

export interface DesignedListener {
  type: 'listener';
  data: ListenerData;
  displayMesh: THREE.Object3D;
  display: {
    base: THREE.Mesh;
    pole: THREE.Mesh;
    rail: THREE.Mesh;
    micLeft: THREE.Mesh;
    micRight: THREE.Mesh;
    coneLeft: THREE.Mesh;
    coneRight: THREE.Mesh;
  };
}

export type DesignedObject = DesignedEmitter | DesignedListener;
