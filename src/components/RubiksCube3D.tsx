"use client";

import { useRef, useMemo, useCallback, useState, Suspense, useEffect } from "react";
import { Canvas, useThree, useFrame, type ThreeEvent } from "@react-three/fiber";
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
const STICKER_OFFSET = 0.003;
const STICKER_SIZE = CUBIE_SIZE * 0.88;
const STICKER_INSET = CUBIE_SIZE * 0.78;

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

type ClickAnim = "idle" | "pulse" | "shake";

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
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const clickAnimRef = useRef<ClickAnim>("idle");
  const animStartRef = useRef(0);
  const prevHighlight = useRef<StickerHighlight["variant"] | undefined>(undefined);
  const normal = FACE_NORMALS[face];
  const baseColor = FACE_COLORS[face];
  const clickable = Boolean(sticker) && !disabled && !highlight;

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

  useEffect(() => {
    if (highlight === prevHighlight.current) return;
    prevHighlight.current = highlight;
    if (highlight === "incorrect") {
      clickAnimRef.current = "shake";
      animStartRef.current = performance.now();
    } else if (highlight === "correct") {
      clickAnimRef.current = "pulse";
      animStartRef.current = performance.now();
    }
  }, [highlight]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const baseScale = hovered && clickable ? 1.08 : 1;
    let extraScale = 1;
    let shakeX = 0;

    const clickAnim = clickAnimRef.current;
    if (clickAnim !== "idle") {
      const elapsed = (performance.now() - animStartRef.current) / 1000;
      if (clickAnim === "pulse") {
        if (elapsed < 0.35) {
          extraScale = 1 + Math.sin(elapsed * Math.PI / 0.35) * 0.12;
        } else {
          clickAnimRef.current = "idle";
        }
      } else if (clickAnim === "shake") {
        if (elapsed < 0.45) {
          shakeX = Math.sin(elapsed * 40) * 0.025 * (1 - elapsed / 0.45);
        } else {
          clickAnimRef.current = "idle";
        }
      }
    }

    group.scale.setScalar(baseScale * extraScale);
    group.position.x = position.x + shakeX;
    group.position.y = position.y;
    group.position.z = position.z;
  });

  const color = useMemo(() => {
    if (highlight === "correct") return "#22c55e";
    if (highlight === "incorrect") return "#ef4444";
    if (highlight === "hint") return "#facc15";
    if (highlight === "prompt") return "#60a5fa";
    if (hovered && clickable) return brightenHex(baseColor, 0.22);
    return baseColor;
  }, [highlight, baseColor, hovered, clickable]);

  const emissive = useMemo(() => {
    if (highlight) {
      if (highlight === "correct") return "#166534";
      if (highlight === "incorrect") return "#991b1b";
      if (highlight === "hint") return "#a16207";
      return "#1d4ed8";
    }
    if (hovered && clickable) return baseColor;
    return "#000000";
  }, [highlight, hovered, clickable, baseColor]);

  const emissiveIntensity = highlight ? 0.45 : hovered && clickable ? 0.3 : 0;

  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!clickable) return;
      e.stopPropagation();
      setHovered(true);
      document.body.style.cursor = "pointer";
    },
    [clickable],
  );

  const handlePointerOut = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = "default";
  }, []);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (!sticker || disabled || highlight) return;
      e.stopPropagation();
      clickAnimRef.current = "pulse";
      animStartRef.current = performance.now();
      onStickerClick?.(sticker);
    },
    [sticker, disabled, highlight, onStickerClick],
  );

  const isLabeled = Boolean(sticker);

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Outer bevel ring */}
      <mesh renderOrder={1}>
        <planeGeometry args={[STICKER_SIZE, STICKER_SIZE]} />
        <meshStandardMaterial
          color="#0a0a0a"
          roughness={0.7}
          metalness={0.05}
        />
      </mesh>
      {/* Inset sticker face */}
      <mesh
        renderOrder={2}
        position={[0, 0, 0.001]}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <planeGeometry args={[STICKER_INSET, STICKER_INSET]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          roughness={0.35}
          metalness={0.08}
        />
      </mesh>
      {/* Inner highlight edge */}
      <lineSegments position={[0, 0, 0.002]} renderOrder={3}>
        <edgesGeometry args={[new THREE.PlaneGeometry(STICKER_INSET, STICKER_INSET)]} />
        <lineBasicMaterial color="#1a1a1a" transparent opacity={0.5} />
      </lineSegments>
      {hovered && clickable && (
        <mesh position={[0, 0, 0.003]} renderOrder={4}>
          <ringGeometry args={[STICKER_INSET * 0.42, STICKER_INSET * 0.48, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.25} />
        </mesh>
      )}
      {showLetters && isLabeled && sticker && (
        <Text
          position={[0, 0, 0.012]}
          fontSize={0.26}
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

function cubieBodyColor(x: number, y: number, z: number): string {
  const hash = ((x + 2) * 7 + (y + 2) * 13 + (z + 2) * 17) % 5;
  const shades = ["#0f0f0f", "#121212", "#141414", "#101010", "#131313"];
  return shades[hash] ?? "#111111";
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
      radius={0.06}
      smoothness={6}
      position={[x * SPACING, y * SPACING, z * SPACING]}
    >
      <meshStandardMaterial
        color={cubieBodyColor(x, y, z)}
        roughness={0.55}
        metalness={0.12}
      />
    </RoundedBox>
  );
}

function GroundShadow() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.65, 0]} receiveShadow>
      <circleGeometry args={[2.8, 32]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.35} />
    </mesh>
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

  // Reset the camera only when the token actually changes (never on mount),
  // preserving the original behavior while keeping ref access out of render.
  const prevToken = useRef(resetViewToken);
  useEffect(() => {
    if (resetViewToken !== prevToken.current) {
      prevToken.current = resetViewToken;
      resetCamera();
    }
  }, [resetViewToken, resetCamera]);

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
      <color attach="background" args={["#050506"]} />
      <fog attach="fog" args={["#050506", 12, 23]} />

      <ambientLight intensity={0.5} />
      <hemisphereLight args={["#cfcfd6", "#0a0a0c", 0.4]} />
      <directionalLight
        position={[6, 10, 7]}
        intensity={1.35}
        castShadow={false}
      />
      <directionalLight position={[-5, 4, -6]} intensity={0.45} color="#d4d4d8" />
      <directionalLight position={[0, -4, 8]} intensity={0.22} color="#3fb950" />

      <GroundShadow />

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
    <div className="relative h-full min-h-[280px] w-full overflow-hidden rounded-3xl border border-line-strong bg-[radial-gradient(120%_120%_at_50%_0%,#1c1c1f_0%,#050506_70%)] shadow-[0_30px_70px_-40px_rgba(0,0,0,0.9)] sm:min-h-[320px]">
      {/* Subtle inner vignette + top sheen */}
      <div className="pointer-events-none absolute inset-0 z-10 rounded-3xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]" />
      <Canvas
        camera={{ position: INITIAL_CAMERA, fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <CubeScene {...props} />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[11px] font-medium text-slate-200 backdrop-blur-sm">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-brand" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a9 9 0 100 18 9 9 0 000-18zM3.6 9h16.8M3.6 15h16.8M12 3c2.5 2.4 2.5 15.6 0 18M12 3c-2.5 2.4-2.5 15.6 0 18" />
        </svg>
        Drag to rotate
        <span className="text-white/30">·</span>
        Click stickers
      </div>
    </div>
  );
}

export { INITIAL_CAMERA };

function brightenHex(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + Math.round(255 * amount));
  const g = Math.min(255, ((n >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (n & 0xff) + Math.round(255 * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
