'use client';

import { useEffect, useRef } from 'react';

export function RadarCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    let angle = 0;

    // Blip data — random scatter within radar circles
    const blips = Array.from({ length: 18 }, () => ({
      r: 0.2 + Math.random() * 0.75,
      a: Math.random() * Math.PI * 2,
      size: 1 + Math.random() * 2,
      brightness: 0.4 + Math.random() * 0.6,
    }));

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
      const maxR = (Math.min(W, H) / 2) * 0.92;

      // Fade trail
      ctx.fillStyle = 'rgba(10, 10, 11, 0.18)';
      ctx.fillRect(0, 0, W, H);

      // Concentric rings
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (maxR / 4) * i, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(34,34,37,${0.5 + i * 0.1})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Cross lines
      ctx.strokeStyle = 'rgba(34,34,37,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy - maxR);
      ctx.lineTo(cx, cy + maxR);
      ctx.moveTo(cx - maxR, cy);
      ctx.lineTo(cx + maxR, cy);
      ctx.stroke();

      // Manual sweep arc approximation
      const sweepWidth = Math.PI * 0.55;
      const startA = angle - sweepWidth;
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
      gradient.addColorStop(0, 'rgba(255, 184, 0, 0.08)');
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
      ctx.lineTo(
        cx + Math.cos(angle) * maxR,
        cy + Math.sin(angle) * maxR
      );
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

      // Blips — light up as sweep passes
      for (const blip of blips) {
        const bx = cx + Math.cos(blip.a) * blip.r * maxR;
        const by = cy + Math.sin(blip.a) * blip.r * maxR;

        // Angular distance from sweep
        let diff = angle - blip.a;
        while (diff < 0) diff += Math.PI * 2;
        while (diff > Math.PI * 2) diff -= Math.PI * 2;

        const inSweep = diff < sweepWidth + 0.1;
        const glow = inSweep ? Math.max(0, 1 - diff / (sweepWidth + 0.3)) : 0;

        if (glow > 0.02) {
          ctx.beginPath();
          ctx.arc(bx, by, blip.size * (1 + glow), 0, Math.PI * 2);
          const alpha = blip.brightness * glow;
          ctx.fillStyle = `rgba(255, 184, 0, ${alpha})`;
          ctx.shadowColor = '#FFB800';
          ctx.shadowBlur = glow * 8;
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
