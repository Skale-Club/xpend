'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';

interface LoaderProps {
  size?: number;
  className?: string;
}

export function Loader({ size = 120, className }: LoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const donutRef = useRef<THREE.Mesh | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      context: canvas.getContext('webgl2') || undefined,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(size, size);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.z = 500;

    const shape = new THREE.TorusGeometry(70, 20, 60, 160);
    const material = new THREE.MeshPhongMaterial({
      color: 0xe4ecfa,
      shininess: 20,
      opacity: 0.96,
      transparent: true,
    });
    const donut = new THREE.Mesh(shape, material);
    scene.add(donut);
    donutRef.current = donut;

    scene.add(Object.assign(new THREE.DirectionalLight(0xffffff, 0.3), { position: { set: (x: number, y: number, z: number) => { (scene.children[scene.children.length-1] as THREE.DirectionalLight).position.set(x,y,z); } } }));
    const lightTop = new THREE.DirectionalLight(0xffffff, 0.3);
    lightTop.position.set(0, 200, 0);
    scene.add(lightTop);
    const frontTop = new THREE.DirectionalLight(0xffffff, 0.4);
    frontTop.position.set(0, 0, 300);
    scene.add(frontTop);
    scene.add(new THREE.AmbientLight(0xcdd9ed));

    let mat = Math.PI;
    const speed = Math.PI / 120;
    let forwards = 1;

    const twist = (geometry: THREE.TorusGeometry, amount: number) => {
      const positionAttribute = geometry.getAttribute('position');
      const quaternion = new THREE.Quaternion();
      const tempVector = new THREE.Vector3();
      for (let i = 0; i < positionAttribute.count; i++) {
        tempVector.fromBufferAttribute(positionAttribute, i);
        quaternion.setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          (Math.PI / 180) * (tempVector.x / amount),
        );
        tempVector.applyQuaternion(quaternion);
        positionAttribute.setXYZ(i, tempVector.x, tempVector.y, tempVector.z);
      }
      positionAttribute.needsUpdate = true;
    };

    const render = () => {
      animationRef.current = requestAnimationFrame(render);
      if (donutRef.current) donutRef.current.rotation.x -= speed * forwards;
      mat -= speed;
      if (mat <= 0) { mat = Math.PI; forwards *= -1; }
      twist(shape, (mat >= Math.PI / 2 ? -120 : 120) * forwards);
      renderer.render(scene, camera);
    };
    render();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      renderer.dispose();
    };
  }, [size]);

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <canvas ref={canvasRef} style={{ width: size, height: size }} />
    </div>
  );
}

export function LoaderOverlay({ size = 120 }: { size?: number }) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <Loader size={size} />
    </div>
  );
}

export function LoaderInline({ size = 40 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center p-8">
      <Loader size={size} />
    </div>
  );
}
