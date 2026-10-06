import * as THREE from 'three';
import { Car } from '../demone/car.js';

// La jeep del noleggio: scoperta, color sabbia, con il roll-bar e la ruota di
// scorta dietro. Stessa guida della macchina del campo, ma più lenta e più alta.
export class Jeep extends Car {
  constructor(scene) {
    super(scene, { maxSpeed: 21, turboSpeed: 28 });
  }

  build() {
    const paint = new THREE.MeshStandardMaterial({ color: '#c8b07a', roughness: 0.75 });
    const dark = new THREE.MeshStandardMaterial({ color: '#22231f', roughness: 0.9 });
    const steel = new THREE.MeshStandardMaterial({ color: '#5a5c58', metalness: 0.6, roughness: 0.4 });
    const seat = new THREE.MeshStandardMaterial({ color: '#3a3428', roughness: 0.95 });
    const glass = new THREE.MeshStandardMaterial({ color: '#b8d4e8', transparent: true, opacity: 0.3, roughness: 0.05 });

    const add = (geo, mat, x, y, z, parent = this.body) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };

    // telaio alto, cassone squadrato
    add(new THREE.BoxGeometry(2.0, 0.7, 4.0), paint, 0, 1.0, 0);
    add(new THREE.BoxGeometry(1.9, 0.3, 1.3), paint, 0, 1.45, 1.3); // cofano
    add(new THREE.BoxGeometry(2.3, 0.12, 0.9), paint, 0, 1.38, 1.45); // parafanghi davanti
    add(new THREE.BoxGeometry(2.3, 0.12, 0.9), paint, 0, 1.38, -1.45); // parafanghi dietro
    add(new THREE.BoxGeometry(2.1, 0.35, 0.3), dark, 0, 0.75, 2.05); // paraurti
    add(new THREE.BoxGeometry(2.1, 0.3, 0.25), dark, 0, 0.75, -2.05);
    // griglia a feritoie
    for (let i = -3; i <= 3; i++) add(new THREE.BoxGeometry(0.08, 0.32, 0.04), dark, i * 0.18, 1.32, 1.97);
    // parabrezza ribaltabile con cornice
    const frame = new THREE.Group();
    frame.position.set(0, 1.6, 0.62);
    frame.rotation.x = -0.25;
    this.body.add(frame);
    add(new THREE.BoxGeometry(1.9, 0.08, 0.08), steel, 0, 0.7, 0, frame);
    add(new THREE.BoxGeometry(0.08, 0.7, 0.08), steel, 0.92, 0.35, 0, frame);
    add(new THREE.BoxGeometry(0.08, 0.7, 0.08), steel, -0.92, 0.35, 0, frame);
    add(new THREE.BoxGeometry(1.8, 0.64, 0.03), glass, 0, 0.35, 0, frame).castShadow = false;
    // roll-bar
    for (const x of [0.9, -0.9]) add(new THREE.BoxGeometry(0.09, 1.0, 0.09), steel, x, 1.85, -0.95);
    add(new THREE.BoxGeometry(1.9, 0.09, 0.09), steel, 0, 2.35, -0.95);
    // sedili
    for (const x of [0.45, -0.45]) {
      add(new THREE.BoxGeometry(0.62, 0.22, 0.62), seat, x, 1.42, -0.3);
      add(new THREE.BoxGeometry(0.62, 0.7, 0.16), seat, x, 1.75, -0.66);
    }
    add(new THREE.BoxGeometry(1.6, 0.22, 0.55), seat, 0, 1.42, -1.35);
    const wheel = add(new THREE.TorusGeometry(0.19, 0.035, 8, 20), dark, 0.45, 1.8, 0.25);
    wheel.rotation.x = -0.9;
    // ruota di scorta
    const spare = add(new THREE.CylinderGeometry(0.46, 0.46, 0.3, 18), dark, 0, 1.3, -2.25);
    spare.rotation.x = Math.PI / 2;

    const headMat = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff4d0', emissiveIntensity: 1.6 });
    for (const x of [0.72, -0.72]) {
      const h = add(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 14), headMat, x, 1.35, 1.99);
      h.rotation.x = Math.PI / 2;
    }
    this.tailMat = new THREE.MeshStandardMaterial({ color: '#400', emissive: '#ff2020', emissiveIntensity: 0.6 });
    for (const x of [0.85, -0.85]) add(new THREE.BoxGeometry(0.2, 0.2, 0.06), this.tailMat, x, 1.1, -2.03);

    this.driver = this.person('#e0b089', '#3b2a1e', '#2f4f8f', 0.45);
    this.friend = this.person('#c99470', '#141414', '#d9a82e', -0.45);
    this.driver.group.position.y = 1.5;
    this.friend.group.position.y = 1.5;

    // ruote grosse da sterrato
    const tire = new THREE.CylinderGeometry(0.52, 0.52, 0.42, 18);
    tire.rotateZ(Math.PI / 2);
    const hub = new THREE.CylinderGeometry(0.24, 0.24, 0.44, 8);
    hub.rotateZ(Math.PI / 2);
    this.wheels = [];
    for (const [x, z, front] of [[1.05, 1.45, true], [-1.05, 1.45, true], [1.05, -1.45, false], [-1.05, -1.45, false]]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.52, z);
      this.body.add(pivot);
      const spin = new THREE.Group();
      pivot.add(spin);
      add(tire, dark, 0, 0, 0, spin);
      add(hub, steel, 0, 0, 0, spin);
      this.wheels.push({ pivot, spin, front });
    }

    this.headlight = new THREE.SpotLight('#ffe8c0', 0, 120, 0.45, 0.5, 1);
    this.headlight.position.set(0, 1.3, 2.0);
    this.headlight.target.position.set(0, -2, 30);
    this.body.add(this.headlight, this.headlight.target);
  }
}
