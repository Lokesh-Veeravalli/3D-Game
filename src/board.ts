import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Color, PieceSymbol, Square } from "chess.js";

const FILES = "abcdefgh";
const SQUARE_SIZE = 1;
const BOARD_OFFSET = 3.5;

export type PieceMesh = THREE.Group & {
  userData: {
    square: Square;
    color: Color;
    type: PieceSymbol;
  };
};

function squareToWorld(square: Square): { x: number; z: number } {
  const file = FILES.indexOf(square[0]!);
  const rank = Number(square[1]) - 1;
  return {
    x: file - BOARD_OFFSET,
    z: BOARD_OFFSET - rank,
  };
}

function worldToSquare(x: number, z: number): Square | null {
  const file = Math.round(x + BOARD_OFFSET);
  const rank = Math.round(BOARD_OFFSET - z);
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return `${FILES[file]}${rank + 1}` as Square;
}

function makePieceGeometry(type: PieceSymbol): THREE.BufferGeometry {
  switch (type) {
    case "p":
      return new THREE.ConeGeometry(0.22, 0.55, 16);
    case "r":
      return new THREE.BoxGeometry(0.42, 0.55, 0.42);
    case "n": {
      const shape = new THREE.Shape();
      shape.moveTo(-0.18, 0);
      shape.lineTo(0.22, 0.05);
      shape.lineTo(0.1, 0.45);
      shape.lineTo(-0.05, 0.55);
      shape.lineTo(-0.22, 0.35);
      shape.lineTo(-0.12, 0.2);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.22,
        bevelEnabled: false,
      });
      geo.center();
      geo.rotateX(-Math.PI / 2);
      return geo;
    }
    case "b":
      return new THREE.ConeGeometry(0.28, 0.75, 16);
    case "q": {
      const geo = new THREE.CylinderGeometry(0.18, 0.32, 0.7, 8);
      return geo;
    }
    case "k": {
      const geo = new THREE.CylinderGeometry(0.2, 0.34, 0.8, 12);
      return geo;
    }
    default:
      return new THREE.SphereGeometry(0.25, 16, 16);
  }
}

function pieceHeight(type: PieceSymbol): number {
  switch (type) {
    case "p":
      return 0.28;
    case "r":
      return 0.28;
    case "n":
      return 0.2;
    case "b":
      return 0.38;
    case "q":
      return 0.35;
    case "k":
      return 0.4;
    default:
      return 0.25;
  }
}

export class ChessScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly scene: THREE.Scene;
  readonly controls: OrbitControls;
  readonly boardGroup = new THREE.Group();
  readonly piecesGroup = new THREE.Group();
  private squareMeshes = new Map<Square, THREE.Mesh>();
  private pieceMeshes = new Map<Square, PieceMesh>();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private baseLightMats = {
    light: new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.55 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x4a6b55, roughness: 0.55 }),
  };
  private selectedMat = new THREE.MeshStandardMaterial({
    color: 0xc4a35a,
    emissive: 0x6a5420,
    emissiveIntensity: 0.35,
    roughness: 0.5,
  });
  private legalMat = new THREE.MeshStandardMaterial({
    color: 0x7cb89a,
    emissive: 0x2a5a40,
    emissiveIntensity: 0.45,
    roughness: 0.45,
  });
  private captureMat = new THREE.MeshStandardMaterial({
    color: 0xe07a5f,
    emissive: 0x5a2010,
    emissiveIntensity: 0.4,
    roughness: 0.45,
  });

  private whiteMat = new THREE.MeshStandardMaterial({
    color: 0xf5f0e6,
    roughness: 0.35,
    metalness: 0.08,
  });
  private blackMat = new THREE.MeshStandardMaterial({
    color: 0x2c3230,
    roughness: 0.4,
    metalness: 0.15,
  });

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a2420);
    this.scene.fog = new THREE.Fog(0x1a2420, 18, 36);

    this.camera = new THREE.PerspectiveCamera(
      42,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    this.camera.position.set(0, 10.5, 9.5);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = 8;
    this.controls.maxDistance = 22;
    this.controls.maxPolarAngle = Math.PI / 2.15;
    this.controls.minPolarAngle = 0.35;

    this.setupLights();
    this.buildBoard();
    this.scene.add(this.boardGroup);
    this.scene.add(this.piecesGroup);

    window.addEventListener("resize", () => this.onResize());
  }

  private setupLights(): void {
    const ambient = new THREE.AmbientLight(0xc8d4cc, 0.55);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(0xfff2d6, 1.15);
    key.position.set(6, 12, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x8ab0a0, 0.35);
    fill.position.set(-5, 6, -4);
    this.scene.add(fill);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(14, 48),
      new THREE.MeshStandardMaterial({
        color: 0x15201c,
        roughness: 0.95,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  private buildBoard(): void {
    const geo = new THREE.BoxGeometry(SQUARE_SIZE, 0.12, SQUARE_SIZE);
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const isLight = (file + rank) % 2 === 1;
        const mesh = new THREE.Mesh(
          geo,
          isLight ? this.baseLightMats.light : this.baseLightMats.dark,
        );
        mesh.position.set(file - BOARD_OFFSET, 0, BOARD_OFFSET - rank);
        mesh.receiveShadow = true;
        const square = `${FILES[file]}${rank + 1}` as Square;
        mesh.userData.square = square;
        mesh.userData.isLight = isLight;
        this.boardGroup.add(mesh);
        this.squareMeshes.set(square, mesh);
      }
    }

    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(8.4, 0.18, 8.4),
      new THREE.MeshStandardMaterial({
        color: 0x3a2e22,
        roughness: 0.7,
      }),
    );
    rim.position.y = -0.08;
    rim.receiveShadow = true;
    this.boardGroup.add(rim);
  }

  setBoard(
    pieces: Array<{ square: Square; type: PieceSymbol; color: Color }>,
  ): void {
    for (const mesh of this.pieceMeshes.values()) {
      this.piecesGroup.remove(mesh);
      this.disposePiece(mesh);
    }
    this.pieceMeshes.clear();
    for (const piece of pieces) {
      const mesh = this.createPiece(piece.type, piece.color, piece.square);
      this.piecesGroup.add(mesh);
      this.pieceMeshes.set(piece.square, mesh);
    }
  }

  private createPiece(
    type: PieceSymbol,
    color: Color,
    square: Square,
  ): PieceMesh {
    const group = new THREE.Group() as PieceMesh;
    const bodyMat = (color === "w" ? this.whiteMat : this.blackMat).clone();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.32, 0.1, 20),
      bodyMat,
    );
    base.position.y = 0.05;
    base.castShadow = true;
    group.add(base);

    const body = new THREE.Mesh(makePieceGeometry(type), bodyMat);
    body.position.y = pieceHeight(type) + 0.12;
    body.castShadow = true;
    group.add(body);

    if (type === "k") {
      const crossV = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.28, 0.08),
        bodyMat,
      );
      crossV.position.y = 0.95;
      crossV.castShadow = true;
      group.add(crossV);
      const crossH = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.08, 0.08),
        bodyMat,
      );
      crossH.position.y = 1.0;
      crossH.castShadow = true;
      group.add(crossH);
    }

    if (type === "q") {
      const crown = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 12),
        bodyMat,
      );
      crown.position.y = 0.78;
      crown.castShadow = true;
      group.add(crown);
    }

    const { x, z } = squareToWorld(square);
    group.position.set(x, 0.06, z);
    group.userData = { square, color, type };
    return group;
  }

  private disposePiece(mesh: PieceMesh): void {
    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  setSelection(square: Square | null, legal: Square[], occupied: Set<Square>): void {
    const legalTargets = new Set(legal);

    for (const [sq, mesh] of this.squareMeshes) {
      const isLight = mesh.userData.isLight as boolean;
      if (sq === square) {
        mesh.material = this.selectedMat;
      } else if (legalTargets.has(sq)) {
        mesh.material = occupied.has(sq) ? this.captureMat : this.legalMat;
      } else {
        mesh.material = isLight
          ? this.baseLightMats.light
          : this.baseLightMats.dark;
      }
    }
  }

  clearSelection(): void {
    this.setSelection(null, [], new Set());
  }

  pickSquare(clientX: number, clientY: number): Square | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const pieceHits = this.raycaster.intersectObjects(
      this.piecesGroup.children,
      true,
    );
    if (pieceHits.length > 0) {
      let obj: THREE.Object3D | null = pieceHits[0]!.object;
      while (obj && !obj.userData.square) obj = obj.parent;
      if (obj?.userData.square) return obj.userData.square as Square;
    }

    const boardHits = this.raycaster.intersectObjects(
      this.boardGroup.children,
      false,
    );
    for (const hit of boardHits) {
      if (hit.object.userData.square) {
        return hit.object.userData.square as Square;
      }
    }

    // Fallback from ground plane
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(plane, point)) {
      return worldToSquare(point.x, point.z);
    }
    return null;
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
