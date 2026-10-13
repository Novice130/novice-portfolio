// Company in the gallery: two people looking at the works, who move on to
// another work when the visitor comes near, and a cat that leads the way.
//
// Behaviour lives in logic/visitors.ts. The figures here are plain stand-ins
// (a mannequin and a simple cat) until rigged models are supplied; swapping
// them in means replacing buildPerson / buildCat and driving an AnimationMixer
// from `actor.speed`, nothing else.
import * as THREE from 'three';
import { CORRIDOR, SALON, pieceSlot, stops, type SceneCtx, type ScenePart, type ThemeName } from '../contract';
import { pieces } from '@/data/gallery';
import { catGoal, stepCat, stepVisitor, type Actor, type Spot } from '../logic/visitors';

/** How far from the wall a person stands to look at a work (m). */
const VIEW_DIST = 1.6;
/** Works the two people start at (piece indices). */
const START = [3, 6];
const COATS = [0x2f3640, 0x6b5a48];
const CENTRE_STOP = Math.max(0, stops.findIndex((s) => s.kind === 'centerpiece'));
/** Where the cat waits in the salon: in front of the plinth, to the right. */
const CAT_SALON = { x: SALON.center[0] + 1.9, z: SALON.center[2] + 2.6 };

type Figure = { root: THREE.Group; body: THREE.Object3D; stride: number };

export function createVisitors(ctx: SceneCtx): ScenePart {
  const group = new THREE.Group();
  group.name = 'visitors';
  const disposables: { dispose: () => void }[] = [];
  const own = <T extends { dispose: () => void }>(item: T): T => (disposables.push(item), item);

  const spots: Spot[] = pieces.map((_, i) => {
    const slot = pieceSlot(i);
    return {
      x: slot.side * (CORRIDOR.width / 2 - VIEW_DIST),
      z: slot.position[2],
      yaw: Math.atan2(slot.side, 0), // facing the wall the work hangs on
    };
  });

  const skin = own(new THREE.MeshStandardMaterial({ color: 0xb98b6c, roughness: 0.7 }));
  const hair = own(new THREE.MeshStandardMaterial({ color: 0x1d1814, roughness: 0.85 }));
  const fur = own(new THREE.MeshStandardMaterial({ color: 0x26211d, roughness: 0.9 }));
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D) => {
    const m = new THREE.Mesh(own(geometry), material);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  function buildPerson(coat: number): Figure {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const cloth = own(new THREE.MeshStandardMaterial({ color: coat, roughness: 0.85 }));
    const trousers = own(new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.8 }));
    mesh(new THREE.CapsuleGeometry(0.075, 0.74, 4, 12), trousers, body).position.set(-0.09, 0.445, 0);
    mesh(new THREE.CapsuleGeometry(0.075, 0.74, 4, 12), trousers, body).position.set(0.09, 0.445, 0);
    const torso = mesh(new THREE.CapsuleGeometry(0.17, 0.42, 6, 16), cloth, body);
    torso.position.y = 1.15;
    torso.scale.set(1.12, 1, 0.72);
    // Hands clasped behind the back: the way people stand in front of a painting.
    mesh(new THREE.CapsuleGeometry(0.045, 0.5, 4, 10), cloth, body).position.set(-0.21, 1.12, -0.03);
    mesh(new THREE.CapsuleGeometry(0.045, 0.5, 4, 10), cloth, body).position.set(0.21, 1.12, -0.03);
    mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.09, 12), skin, body).position.y = 1.5;
    mesh(new THREE.SphereGeometry(0.105, 20, 16), skin, body).position.y = 1.63;
    const cap = mesh(new THREE.SphereGeometry(0.11, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, body);
    cap.position.set(0, 1.645, -0.012);
    group.add(root);
    return { root, body, stride: 0 };
  }

  function buildCat(): Figure {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const trunk = mesh(new THREE.CapsuleGeometry(0.075, 0.26, 6, 14), fur, body);
    trunk.rotation.x = Math.PI / 2;
    trunk.position.set(0, 0.2, 0);
    mesh(new THREE.SphereGeometry(0.068, 16, 12), fur, body).position.set(0, 0.29, 0.2);
    for (const side of [-1, 1]) {
      const ear = mesh(new THREE.ConeGeometry(0.026, 0.05, 8), fur, body);
      ear.position.set(side * 0.04, 0.355, 0.2);
      for (const z of [-0.11, 0.11]) {
        mesh(new THREE.CylinderGeometry(0.018, 0.016, 0.16, 8), fur, body).position.set(side * 0.045, 0.08, z);
      }
    }
    const tail = mesh(new THREE.CylinderGeometry(0.014, 0.01, 0.3, 8), fur, body);
    tail.position.set(0, 0.34, -0.24);
    tail.rotation.x = -0.5;
    group.add(root);
    return { root, body, stride: 0 };
  }

  const people = START.map((piece, i) => ({
    figure: buildPerson(COATS[i % COATS.length]),
    actor: { x: spots[piece].x, z: spots[piece].z, yaw: spots[piece].yaw, speed: 0, spot: piece } as Actor,
  }));
  const cat = {
    figure: buildCat(),
    actor: { x: 0.55, z: ctx.camera.position.z - 6, yaw: 0, speed: 0, spot: -1 } as Actor,
  };

  const pose = (figure: Figure, actor: Actor, dt: number, bob: number, rate: number) => {
    figure.root.position.set(actor.x, 0, actor.z);
    figure.root.rotation.y = actor.yaw;
    // A walking cue for the stand-ins: a small bob in step with the distance covered.
    figure.stride += actor.speed * dt * rate;
    figure.body.position.y = actor.speed > 0 ? Math.abs(Math.sin(figure.stride)) * bob : 0;
  };
  for (const p of people) pose(p.figure, p.actor, 0, 0, 0);
  pose(cat.figure, cat.actor, 0, 0, 0);

  let placedCat = false;

  function update(dt: number, _elapsed: number, focus: number): boolean {
    const cam = { x: ctx.camera.position.x, z: ctx.camera.position.z };
    let busy = false;

    for (const p of people) {
      const taken = people.filter((o) => o !== p).map((o) => o.actor.spot);
      const next = stepVisitor(p.actor, spots, cam, taken, dt);
      if (next !== p.actor) {
        p.actor = next;
        pose(p.figure, next, dt, 0.022, 5.2);
        busy = true;
      }
    }

    // The cat leads down the corridor, waits by the plinth in the salon, and
    // sits tight while the visitor has stepped aside to face a work.
    const facing = document.documentElement.dataset.g3face !== undefined && stops[Math.round(focus)]?.kind === 'piece';
    const goal = facing
      ? { x: cat.actor.x, z: cat.actor.z }
      : focus > CENTRE_STOP - 0.4
        ? CAT_SALON
        : catGoal(cam, CORRIDOR.zEnd + 1.5);
    if (!placedCat) {
      // First frame: already waiting ahead, not sprinting in from the door.
      placedCat = true;
      cat.actor = { ...cat.actor, x: goal.x, z: goal.z, yaw: Math.atan2(cam.x - goal.x, cam.z - goal.z) };
      pose(cat.figure, cat.actor, 0, 0, 0);
    }
    const nextCat = stepCat(cat.actor, goal, cam, dt);
    if (nextCat !== cat.actor) {
      cat.actor = nextCat;
      pose(cat.figure, nextCat, dt, 0.018, 9);
      busy = true;
    }
    return busy;
  }

  const setTheme = (_theme: ThemeName) => {};

  const dispose = () => {
    group.removeFromParent();
    group.clear();
    for (const item of disposables) item.dispose();
    disposables.length = 0;
  };

  return { group, setTheme, update, dispose };
}
