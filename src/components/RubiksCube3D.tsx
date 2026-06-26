"use client";

import { useRef, useMemo, useCallback, Suspense } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Text, RoundedBox } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import {
  FACE_COLORS,
  getStickerAtCubieFace,
} from "@/lib/stickers";
import type { Face, Sticker, StickerHighlight } from "@/types/cube";

const CUBIE_SIZE = 0.94;
const CUBIE_GAP = 0.06;
const SPACING = CUBIE_SIZE + CUBIE_GAP;
const STICKER_OFFSET = 0.002;

const FACE_NORMALS: Record<Face, THREE.Vector3> = {
  U: new THREE.Vector3(0, 1, 0),
  D: new THREE.Vector3(0, -1, 0),
  F: new THREE.Vector3(0, 0, 1),
  B: new THREE.Vector3(0, 0, -1),
  R: new THREE.Vector3(1, 0, 0),
  L: new THREE.Vector3(-1, 0, 0),
};

const INITIAL_CAMERA: [number, number, number] = [4.5, 3.5, 6];

interface RubiksCube3DProps {
  onStickerClick?: (sticker: Sticker) => void;
  highlights?: StickerHighlight[];
  showLetters?: boolean;
  focusFace?: Face | null;
  disabled?: boolean;
  onResetView?: () => void;
  resetViewToken?: number;
}

interface StickerMeshProps {
  sticker: Sticker | null;
  face: Face;
  cubieX: -1 | 0 | 1;
  cubieY: -1 | 0 | 1;
  cubieZ: -1 | 0 | 1;
  showLetters: boolean;
  highlight?: StickerHighlight["variant"];
  onStickerClick?: (sticker: Sticker) => void;
  disabled?: boolean;
}

function getHighlightVariant(
  stickerId: string | undefined,
  highlights: StickerHighlight[],
): StickerHighlight["variant"] | undefined {
  if (!stickerId) return undefined;
  return highlights.find((h) => h.stickerId === stickerId)?.variant;
}

function StickerMesh({
  sticker,
  face,
  cubieX,
  cubieY,
  cubieZ,
  showLetters,
  highlight,
  onStickerClick,
  disabled,
}: StickerMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const normal = FACE_NORMALS[face];
  const baseColor = FACE_COLORS[face];

  const position = useMemo(() => {
    const center = new THREE.Vector3(
      cubieX * SPACING,
      cubieY * SPACING,
      cubieZ * SPACING,
    );
    return center.add(normal.clone().multiplyScalar(CUBIE_SIZE / 2 + STICKER_OFFSET));
  }, [cubieX, cubieY, cubieZ, normal]);

  const rotation = useMemo(() => {
    const euler = new THREE.Euler();
    const up = new THREE.Vector3(0, 1, 0);
    const m = new THREE.Matrix4().lookAt(
      new THREE.Vector3(0, 0, 0),
      normal.clone().negate(),
      up,
    );
    euler.setFromRotationMatrix(m);
    return euler;
  }, [normal]);

  const color = useMemo(() => {
    if (highlight === "correct") return "#22c55e";
    if (highlight === "incorrect") return "#ef4444";
    if (highlight === "hint") return "#facc15";
    if (highlight === "prompt") return "#60a5fa";
    return baseColor;
  }, [highlight, baseColor]);

  const emissive = useMemo(() => {
    if (!highlight) return "#000000";
    if (highlight === "correct") return "#166534";
    if (highlight === "incorrect") return "#991b1b";
    if (highlight === "hint") return "#a16207";
    return "#1d4ed8";
  }, [highlight]);

  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!sticker || disabled) return;
      e.stopPropagation();
      document.body.style.cursor = "pointer";
    },
    [sticker, disabled],
  );

  const handlePointerOut = useCallback(() => {
    document.body.style.cursor = "default";
  }, []);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (!sticker || disabled) return;
      e.stopPropagation();
      onStickerClick?.(sticker);
    },
    [sticker, disabled, onStickerClick],
  );

  const isLabeled = Boolean(sticker);

  return (
    <group position={position} rotation={rotation}>
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <planeGeometry args={[CUBIE_SIZE * 0.92, CUBIE_SIZE * 0.92]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={highlight ? 0.35 : 0}
          roughness={0.45}
          metalness={0.05}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry
          args={[new THREE.PlaneGeometry(CUBIE_SIZE * 0.92, CUBIE_SIZE * 0.92)]}
        />
        <lineBasicMaterial color="#1a1a1a" transparent opacity={0.35} />
      </lineSegments>
      {showLetters && isLabeled && sticker && (
        <Text
          position={[0, 0, 0.01]}
          fontSize={0.28}
          color="#111111"
          anchorX="center"
          anchorY="middle"
          fontWeight={700}
        >
          {sticker.letter}
        </Text>
      )}
    </group>
  );
}

function CubieBody({
  x,
  y,
  z,
}: {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
  z: -1 | 0 | 1;
}) {
  return (
    <RoundedBox
      args={[CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE]}
      radius={0.04}
      smoothness={4}
      position={[x * SPACING, y * SPACING, z * SPACING]}
    >
      <meshStandardMaterial color="#111111" roughness={0.6} metalness={0.1} />
    </RoundedBox>
  );
}

function CubeScene({
  onStickerClick,
  highlights,
  showLetters,
  focusFace,
  disabled,
  resetViewToken,
}: RubiksCube3DProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();

  const cubies = useMemo(() => {
    const result: { x: -1 | 0 | 1; y: -1 | 0 | 1; z: -1 | 0 | 1 }[] = [];
    for (const x of [-1, 0, 1] as const) {
      for (const y of [-1, 0, 1] as const) {
        for (const z of [-1, 0, 1] as const) {
          result.push({ x, y, z });
        }
      }
    }
    return result;
  }, []);

  const outwardStickers = useMemo(() => {
    const items: {
      face: Face;
      x: -1 | 0 | 1;
      y: -1 | 0 | 1;
      z: -1 | 0 | 1;
      sticker: Sticker | null;
    }[] = [];

    for (const { x, y, z } of cubies) {
      if (y === 1) {
        items.push({
          face: "U",
          x,
          y,
          z,
          sticker: getStickerAtCubieFace("U", x, y, z) ?? null,
        });
      }
      if (y === -1) {
        items.push({
          face: "D",
          x,
          y,
          z,
          sticker: getStickerAtCubieFace("D", x, y, z) ?? null,
        });
      }
      if (z === 1) {
        items.push({
          face: "F",
          x,
          y,
          z,
          sticker: getStickerAtCubieFace("F", x, y, z) ?? null,
        });
      }
      if (z === -1) {
        items.push({
          face: "B",
          x,
          y,
          z,
          sticker: getStickerAtCubieFace("B", x, y, z) ?? null,
        });
      }
      if (x === 1) {
        items.push({
          face: "R",
          x,
          y,
          z,
          sticker: getStickerAtCubieFace("R", x, y, z) ?? null,
        });
      }
      if (x === -1) {
        items.push({
          face: "L",
          x,
          y,
          z,
          sticker: getStickerAtCubieFace("L", x, y, z) ?? null,
        });
      }
    }
    return items;
  }, [cubies]);

  const resetCamera = useCallback(() => {
    camera.position.set(...INITIAL_CAMERA);
    camera.lookAt(0, 0, 0);
    controlsRef.current?.target.set(0, 0, 0);
    controlsRef.current?.update();
  }, [camera]);

  const prevToken = useRef(resetViewToken);
  if (resetViewToken !== prevToken.current) {
    prevToken.current = resetViewToken;
    resetCamera();
  }

  const focusRotation = useMemo(() => {
    if (!focusFace) return [0, 0, 0] as [number, number, number];
    const map: Record<Face, [number, number, number]> = {
      F: [0, 0, 0],
      B: [0, Math.PI, 0],
      U: [-Math.PI / 2, 0, 0],
      D: [Math.PI / 2, 0, 0],
      R: [0, Math.PI / 2, 0],
      L: [0, -Math.PI / 2, 0],
    };
    return map[focusFace];
  }, [focusFace]);

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[5, 8, 6]} intensity={1.1} />
      <directionalLight position={[-4, -2, -5]} intensity={0.35} />

      <group rotation={focusRotation}>
        {cubies.map(({ x, y, z }) => (
          <CubieBody key={`${x}-${y}-${z}`} x={x} y={y} z={z} />
        ))}

        {outwardStickers.map(({ face, x, y, z, sticker }) => {
          const stickerId = sticker?.id;
          const variant = getHighlightVariant(stickerId, highlights ?? []);
          const dimmed =
            focusFace && sticker ? sticker.face !== focusFace : false;

          return (
            <group key={`${face}-${x}-${y}-${z}`} visible={!dimmed}>
              <StickerMesh
                sticker={sticker}
                face={face}
                cubieX={x}
                cubieY={y}
                cubieZ={z}
                showLetters={showLetters ?? false}
                highlight={variant}
                onStickerClick={onStickerClick}
                disabled={disabled || !sticker}
              />
            </group>
          );
        })}
      </group>

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={5}
        maxDistance={14}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}

export default function RubiksCube3D(props: RubiksCube3DProps) {
  return (
    <div className="relative h-full min-h-[320px] w-full rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-inner">
      <Canvas
        camera={{ position: INITIAL_CAMERA, fov: 45 }}
        gl={{ antialias: true }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <CubeScene {...props} />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/40 px-2 py-1 text-xs text-slate-300">
        Drag to rotate · Click stickers
      </div>
    </div>
  );
}

export { INITIAL_CAMERA };
