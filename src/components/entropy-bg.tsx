"use client";

import { useEffect, useRef, useState } from "react";

interface EntropyBgProps {
  className?: string;
  progress?: number;
  autoPlayDurationMs?: number;
}

function useTheme(): { color: string; isDark: boolean } {
  const [theme, setTheme] = useState<{ color: string; isDark: boolean }>({ color: "#ffffff", isDark: true });
  useEffect(() => {
    const compute = () => {
      const isDark = document.documentElement.classList.contains("dark");
      setTheme({ color: isDark ? "#ffffff" : "#000000", isDark });
    };
    compute();
    const observer = new MutationObserver(compute);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

const REF_SPACING = 16;
const SPEED_BOOST = 1.6;
const PARTICLE_SIZE = 2.8;
const CONNECTION_MAX_ALPHA = 0.4;
const CONNECTION_BUCKETS = 4;
const ORDER_EASE = 0.04;

function getCellSize(viewportWidth: number): number {
  return viewportWidth < 640 ? 28 : 44;
}

function hexAlpha(a: number): string {
  const clamped = Math.max(0, Math.min(1, a));
  return Math.round(clamped * 255).toString(16).padStart(2, "0");
}

export function EntropyBg({ className = "", progress, autoPlayDurationMs = 30000 }: EntropyBgProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { color: particleColor, isDark } = useTheme();
  const progressRef = useRef<number>(progress ?? 0);
  const externalControlRef = useRef<boolean>(progress !== undefined);
  const particleColorRef = useRef<string>(particleColor);
  const alphaMultiplierRef = useRef<number>(isDark ? 1.0 : 0.55);
  const autoPlayDurationMsRef = useRef<number>(autoPlayDurationMs);

  useEffect(() => {
    externalControlRef.current = progress !== undefined;
    if (progress !== undefined) progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    particleColorRef.current = particleColor;
    alphaMultiplierRef.current = isDark ? 1.0 : 0.55;
  }, [particleColor, isDark]);

  useEffect(() => {
    autoPlayDurationMsRef.current = autoPlayDurationMs;
  }, [autoPlayDurationMs]);

  useEffect(() => {
    const container = containerRef.current!;
    const canvas = canvasRef.current!;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true })!;
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = container.clientWidth;
    let height = container.clientHeight;
    let cellSize = getCellSize(width);
    let scale = cellSize / REF_SPACING;
    let neighborRadius = 100 * scale;
    let connectionRadius = 50 * scale;
    let initVelocity = 2 * scale * SPEED_BOOST;
    let chaosJitter = 0.5 * scale * SPEED_BOOST;
    const returnStrength = 0.05 * SPEED_BOOST;

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      ox: number;
      oy: number;
      orderFactor: number;
      neighbors: Particle[];

      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.ox = x;
        this.oy = y;
        this.vx = (Math.random() - 0.5) * initVelocity;
        this.vy = (Math.random() - 0.5) * initVelocity;
        this.orderFactor = 0;
        this.neighbors = [];
      }

      update(w: number, h: number, frontX: number) {
        const targetOrder = this.ox < frontX ? 1 : 0;
        this.orderFactor += (targetOrder - this.orderFactor) * ORDER_EASE;

        this.vx += (Math.random() - 0.5) * chaosJitter;
        this.vy += (Math.random() - 0.5) * chaosJitter;
        const damping = 0.95 - this.orderFactor * 0.12;
        this.vx *= damping;
        this.vy *= damping;

        const chaosX = this.x + this.vx;
        const chaosY = this.y + this.vy;

        const orderPull = returnStrength + this.orderFactor * 0.05;
        const orderX = this.x + (this.ox - this.x) * orderPull;
        const orderY = this.y + (this.oy - this.y) * orderPull;

        this.x = orderX * this.orderFactor + chaosX * (1 - this.orderFactor);
        this.y = orderY * this.orderFactor + chaosY * (1 - this.orderFactor);

        if (this.x < 0) { this.x = 0; this.vx = -this.vx; }
        else if (this.x > w) { this.x = w; this.vx = -this.vx; }
        if (this.y < 0) { this.y = 0; this.vy = -this.vy; }
        else if (this.y > h) { this.y = h; this.vy = -this.vy; }
      }
    }

    let particles: Particle[] = [];
    let bucketSize = Math.max(neighborRadius, cellSize);
    let bucketCols = 0;
    let bucketRows = 0;
    let buckets: Particle[][] = [];

    function buildGrid(w: number, h: number) {
      particles = [];
      const cols = Math.max(10, Math.round(w / cellSize));
      const rows = Math.max(10, Math.round(h / cellSize));
      const spacingX = w / cols;
      const spacingY = h / rows;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = spacingX * i + spacingX / 2;
          const y = spacingY * j + spacingY / 2;
          particles.push(new Particle(x, y));
        }
      }
    }

    function rebuildBuckets(w: number, h: number) {
      bucketSize = Math.max(neighborRadius, cellSize);
      bucketCols = Math.max(1, Math.ceil(w / bucketSize));
      bucketRows = Math.max(1, Math.ceil(h / bucketSize));
      const len = bucketCols * bucketRows;
      buckets = new Array(len);
      for (let i = 0; i < len; i++) buckets[i] = [];
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const bx = Math.min(bucketCols - 1, Math.max(0, Math.floor(p.x / bucketSize)));
        const by = Math.min(bucketRows - 1, Math.max(0, Math.floor(p.y / bucketSize)));
        buckets[by * bucketCols + bx].push(p);
      }
    }

    function updateNeighbors() {
      rebuildBuckets(width, height);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const bx = Math.min(bucketCols - 1, Math.max(0, Math.floor(p.x / bucketSize)));
        const by = Math.min(bucketRows - 1, Math.max(0, Math.floor(p.y / bucketSize)));
        const neighbors: Particle[] = [];
        const rSq = neighborRadius * neighborRadius;
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const nbx = bx + dx;
            const nby = by + dy;
            if (nbx < 0 || nbx >= bucketCols || nby < 0 || nby >= bucketRows) continue;
            const bucket = buckets[nby * bucketCols + nbx];
            for (let k = 0; k < bucket.length; k++) {
              const other = bucket[k];
              if (other === p) continue;
              const ddx = p.x - other.x;
              const ddy = p.y - other.y;
              if (ddx * ddx + ddy * ddy < rSq) neighbors.push(other);
            }
          }
        }
        p.neighbors = neighbors;
      }
    }

    function resize() {
      width = container.clientWidth;
      height = container.clientHeight;
      if (width <= 0 || height <= 0) return;
      cellSize = getCellSize(width);
      scale = cellSize / REF_SPACING;
      neighborRadius = 100 * scale;
      connectionRadius = 50 * scale;
      initVelocity = 2 * scale * SPEED_BOOST;
      chaosJitter = 0.5 * scale * SPEED_BOOST;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildGrid(width, height);
      updateNeighbors();
    }

    let time = 0;
    let animationId: number | null = null;
    const startTime = performance.now();

    const bucketPaths: Path2D[] = new Array(CONNECTION_BUCKETS);

    function animate() {
      ctx.clearRect(0, 0, width, height);

      if (!externalControlRef.current) {
        const elapsed = performance.now() - startTime;
        progressRef.current = Math.min(1, elapsed / autoPlayDurationMsRef.current);
      }
      const progressNow = progressRef.current;
      const frontX = progressNow * width;

      if (time % 30 === 0) updateNeighbors();

      for (let b = 0; b < CONNECTION_BUCKETS; b++) bucketPaths[b] = new Path2D();

      const currentColor = particleColorRef.current;
      const currentAlpha = alphaMultiplierRef.current;

      ctx.fillStyle = `${currentColor}${hexAlpha(currentAlpha)}`;
      ctx.beginPath();

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.update(width, height, frontX);
        ctx.moveTo(p.x + PARTICLE_SIZE, p.y);
        ctx.arc(p.x, p.y, PARTICLE_SIZE, 0, Math.PI * 2);

        const neighbors = p.neighbors;
        for (let j = 0; j < neighbors.length; j++) {
          const n = neighbors[j];
          if (n.x < p.x || (n.x === p.x && n.y < p.y)) continue;
          const ddx = p.x - n.x;
          const ddy = p.y - n.y;
          const dSq = ddx * ddx + ddy * ddy;
          const connSq = connectionRadius * connectionRadius;
          if (dSq < connSq) {
            const t = 1 - Math.sqrt(dSq) / connectionRadius;
            const bucket = Math.min(CONNECTION_BUCKETS - 1, Math.floor(t * CONNECTION_BUCKETS));
            const path = bucketPaths[bucket];
            path.moveTo(p.x, p.y);
            path.lineTo(n.x, n.y);
          }
        }
      }
      ctx.fill();

      ctx.lineWidth = 1;
      for (let b = 0; b < CONNECTION_BUCKETS; b++) {
        const bucketT = (b + 0.5) / CONNECTION_BUCKETS;
        const alpha = CONNECTION_MAX_ALPHA * bucketT * currentAlpha;
        ctx.strokeStyle = `${currentColor}${hexAlpha(alpha)}`;
        ctx.stroke(bucketPaths[b]);
      }

      const cx = width / 2;
      const cy = height / 2;
      const fadeRadius = Math.min(width, height) * 0.22;
      const innerRadius = fadeRadius * 0.55;
      const fadeGradient = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, fadeRadius);
      fadeGradient.addColorStop(0, "rgba(0,0,0,1)");
      fadeGradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = fadeGradient;
      ctx.fillRect(cx - fadeRadius, cy - fadeRadius, fadeRadius * 2, fadeRadius * 2);
      ctx.restore();

      time++;
      animationId = requestAnimationFrame(animate);
    }

    resize();

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);

    animate();

    return () => {
      if (animationId !== null) cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className={`fixed inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
