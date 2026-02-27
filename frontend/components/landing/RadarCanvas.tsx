'use client';

import { useEffect, useRef } from 'react';

// 3 data sources, each occupying a 120° sector
const SOURCES = [
  {
    label: 'YouTube',
    color: [255, 59, 92] as [number, number, number],   // #FF3B5C
    // Sector centered at 330° (top-right), spanning 270°–30°
    centerDeg: 330,
  },
  {
    label: 'Trends',
    color: [59, 130, 246] as [number, number, number],  // #3B82F6
    // Sector centered at 90° (bottom), spanning 30°–150°
    centerDeg: 90,
  },
  {
    label: 'Farcaster',
    color: [168, 85, 247] as [number, number, number],  // #A855F7
    // Sector centered at 210° (top-left), spanning 150°–270°
    centerDeg: 210,
  },
];

const SECTOR_SPAN = (Math.PI * 2) / 3; // 120° in radians

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

// Generate blips for each source, scattered within their sector
function makeBlips() {
  return SOURCES.flatMap((src, si) => {
    const centerRad = degToRad(src.centerDeg);
    return Array.from({ length: 6 }, () => {
      const spread = (Math.random() - 0.5) * SECTOR_SPAN * 0.85;
      return {
        r: 0.25 + Math.random() * 0.65,
        a: centerRad + spread,
        size: 1 + Math.random() * 2,
        brightness: 0.5 + Math.random() * 0.5,
        sourceIdx: si,
      };
    });
  });
}

export function RadarCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    let angle = 0;
    const blips = makeBlips();

    function resize() {
      if (!canvas) return;
      const size = Math.min(canvas.parentElement?.offsetWidth ?? 420, 420);
      canvas.width = size;
      canvas.height = size;
    }

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    function draw() {
      if (!canvas || !ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;
      const cy = H / 2;
      const maxR = (Math.min(W, H) / 2) * 0.82; // slightly smaller to leave room for labels

      // Fade trail
      ctx.fillStyle = 'rgba(10, 10, 11, 0.18)';
      ctx.fillRect(0, 0, W, H);

      // Sector divider lines (at 0°, 120°, 240°)
      ctx.save();
      ctx.strokeStyle = 'rgba(34,34,37,0.7)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      for (let s = 0; s < 3; s++) {
        const a = degToRad(s * 120);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();

      // Source labels outside circle
      const labelR = maxR + 18;
      ctx.save();
      ctx.font = `bold 10px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      SOURCES.forEach((src, i) => {
        const [r, g, b] = src.color;
        const a = degToRad(src.centerDeg);
        const lx = cx + Math.cos(a) * labelR;
        const ly = cy + Math.sin(a) * labelR;
        ctx.fillStyle = `rgba(${r},${g},${b},0.75)`;
        ctx.fillText(src.label, lx, ly);
      });
      ctx.restore();

      // Concentric rings
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (maxR / 4) * i, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(34,34,37,${0.4 + i * 0.1})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Sweep arc
      const sweepWidth = Math.PI * 0.55;
      const startA = angle - sweepWidth;
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
      gradient.addColorStop(0, 'rgba(255, 184, 0, 0.07)');
      gradient.addColorStop(1, 'rgba(255, 184, 0, 0)');

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxR, startA, angle);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.restore();

      // Sweep leading edge
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR);
      ctx.strokeStyle = 'rgba(255, 184, 0, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#FFB800';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#FFB800';
      ctx.shadowColor = '#FFB800';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Blips — lit up in source color as sweep passes
      for (const blip of blips) {
        const bx = cx + Math.cos(blip.a) * blip.r * maxR;
        const by = cy + Math.sin(blip.a) * blip.r * maxR;

        let diff = angle - blip.a;
        while (diff < 0) diff += Math.PI * 2;
        while (diff > Math.PI * 2) diff -= Math.PI * 2;

        const inSweep = diff < sweepWidth + 0.1;
        const glow = inSweep ? Math.max(0, 1 - diff / (sweepWidth + 0.3)) : 0;

        if (glow > 0.02) {
          const [r, g, b] = SOURCES[blip.sourceIdx].color;
          ctx.beginPath();
          ctx.arc(bx, by, blip.size * (1 + glow), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${blip.brightness * glow})`;
          ctx.shadowColor = `rgb(${r},${g},${b})`;
          ctx.shadowBlur = glow * 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      angle += 0.018;
      if (angle > Math.PI * 2) angle -= Math.PI * 2;
      animFrame = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animFrame);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
