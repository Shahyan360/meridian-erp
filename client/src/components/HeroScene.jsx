import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export default function HeroScene() {
  const host = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = host.current;
    let renderer,
      frame,
      disposed = false;
    const geometries = [],
      materials = [];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
      renderer.setClearColor(0, 0);
      element.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      camera.position.set(0, 1, 10);
      const group = new THREE.Group();
      scene.add(group);
      scene.add(new THREE.AmbientLight(0xffffff, 2));
      const light = new THREE.DirectionalLight(0xffffff, 5);
      light.position.set(3, 5, 5);
      scene.add(light);
      const blueLight = new THREE.PointLight(0x5486ff, 80);
      blueLight.position.set(-4, 1, 3);
      scene.add(blueLight);
      const configs = [
        [0, 0, 0, 0x3c6df0, 1.6],
        [-1.8, 0.9, -0.5, 0xb4caff, 0.95],
        [1.8, 0.6, -0.8, 0x83b7ac, 1.1],
        [1, -1.6, 0.2, 0xd7e3ff, 0.8],
        [-1.6, -1.2, -0.4, 0x8aa9f4, 0.65],
      ];
      for (const [x, y, z, color, size] of configs) {
        const geometry = new THREE.BoxGeometry(size, size, size, 2, 2, 2);
        geometries.push(geometry);
        const material = new THREE.MeshPhysicalMaterial({
          color,
          metalness: 0.15,
          roughness: 0.25,
          clearcoat: 1,
          clearcoatRoughness: 0.15,
        });
        materials.push(material);
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(x, y, z);
        cube.rotation.set(0.25, 0.5, 0.1);
        cube.userData.baseY = y;
        group.add(cube);
        const edgesGeometry = new THREE.EdgesGeometry(geometry);
        geometries.push(edgesGeometry);
        const edgesMaterial = new THREE.LineBasicMaterial({
          color: 0xffffff,
          opacity: 0.2,
          transparent: true,
        });
        materials.push(edgesMaterial);
        cube.add(new THREE.LineSegments(edgesGeometry, edgesMaterial));
      }
      for (const radius of [2.4, 3.1]) {
        const geometry = new THREE.TorusGeometry(radius, 0.009, 8, 100);
        geometries.push(geometry);
        const material = new THREE.MeshBasicMaterial({
          color: 0x789ded,
          opacity: 0.35,
          transparent: true,
        });
        materials.push(material);
        const ring = new THREE.Mesh(geometry, material);
        ring.rotation.set(1.0, 0.25, 0.25);
        group.add(ring);
      }
      const resize = () => {
        if (disposed) return;
        const width = element.clientWidth,
          height = element.clientHeight;
        renderer.setSize(width, height);
        camera.aspect = width / Math.max(height, 1);
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
      };
      const observer = new ResizeObserver(resize);
      observer.observe(element);
      resize();
      let mx = 0,
        my = 0,
        visible = true;
      const pointer = (e) => {
        const bounds = element.getBoundingClientRect();
        mx = (e.clientX - bounds.left) / bounds.width - 0.5;
        my = (e.clientY - bounds.top) / bounds.height - 0.5;
      };
      const reset = () => {
        mx = 0;
        my = 0;
      };
      const clock = new THREE.Clock();
      const render = () => {
        frame = undefined;
        if (disposed || !visible || document.hidden) return;
        const t = clock.getElapsedTime();
        if (!reduced.matches) {
          group.rotation.y += (mx * 0.3 - group.rotation.y) * 0.035;
          group.rotation.x += (my * 0.2 - group.rotation.x) * 0.035;
          group.children.slice(0, 5).forEach((cube, i) => {
            cube.position.y =
              cube.userData.baseY + Math.sin(t * 0.6 + i) * 0.13;
            cube.rotation.y = 0.5 + Math.sin(t * 0.25 + i) * 0.15;
          });
        }
        renderer.render(scene, camera);
        if (!reduced.matches) frame = requestAnimationFrame(render);
      };
      const resume = () => {
        cancelAnimationFrame(frame);
        frame = undefined;
        render();
      };
      const intersection = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !frame) render();
      });
      intersection.observe(element);
      document.addEventListener("visibilitychange", resume);
      reduced.addEventListener("change", resume);
      element.addEventListener("pointermove", pointer);
      element.addEventListener("pointerleave", reset);
      const lost = (e) => {
        e.preventDefault();
        visible = false;
        cancelAnimationFrame(frame);
        setFailed(true);
      };
      renderer.domElement.addEventListener("webglcontextlost", lost);
      render();
      return () => {
        disposed = true;
        cancelAnimationFrame(frame);
        observer.disconnect();
        intersection.disconnect();
        document.removeEventListener("visibilitychange", resume);
        reduced.removeEventListener("change", resume);
        element.removeEventListener("pointermove", pointer);
        element.removeEventListener("pointerleave", reset);
        renderer.domElement.removeEventListener("webglcontextlost", lost);
        geometries.forEach((g) => g.dispose());
        materials.forEach((m) => m.dispose());
        renderer.dispose();
        renderer.domElement.remove();
      };
    } catch {
      renderer?.dispose();
      setFailed(true);
    }
  }, []);
  return failed ? (
    <div className="scene-unavailable">
      <span className="fallback-cube cube-one">M</span>
      <p>Everything, beautifully connected.</p>
    </div>
  ) : (
    <div
      className="three-scene"
      ref={host}
      role="img"
      aria-label="An original animated constellation of connected business modules"
    />
  );
}
