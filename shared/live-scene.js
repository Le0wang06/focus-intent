function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Lightweight 3D-ish canvas scene for extension pages.
 * Built to feel alive without pulling external runtime dependencies.
 */
export function mountLiveScene(canvas, options = {}) {
  if (!canvas) return () => {};
  if (!(canvas instanceof HTMLCanvasElement)) return () => {};

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return () => {};

  const settings = {
    density: clamp(Number(options.density) || 30, 16, 90),
    hue: clamp(Number(options.hue) || 170, 140, 220),
    baseAlpha: clamp(Number(options.baseAlpha) || 0.26, 0.1, 0.45),
    linkDistance: clamp(Number(options.linkDistance) || 120, 70, 200),
    spinSpeed: Number(options.spinSpeed) || 0.00055
  };

  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const points = [];
  const pointer = { x: 0, y: 0, active: false };
  let width = 0;
  let height = 0;
  let raf = 0;
  let running = true;

  function makePoint() {
    return {
      x: randomRange(-1, 1),
      y: randomRange(-1, 1),
      z: randomRange(-1, 1),
      driftX: randomRange(-0.0005, 0.0005),
      driftY: randomRange(-0.0005, 0.0005),
      phase: randomRange(0, Math.PI * 2),
      size: randomRange(1.2, 2.9)
    };
  }

  for (let i = 0; i < settings.density; i += 1) {
    points.push(makePoint());
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function project(point, time) {
    const rot = time * settings.spinSpeed;
    const wobble = Math.sin(time * 0.0004 + point.phase) * 0.08;
    const x = point.x + point.driftX * time + wobble;
    const y = point.y + point.driftY * time + wobble * 0.55;
    const z = point.z;

    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const rx = x * cos - z * sin;
    const rz = x * sin + z * cos + 2.5;

    const perspective = 1 / rz;
    let sx = rx * perspective * width * 0.68 + width / 2;
    let sy = y * perspective * width * 0.68 + height / 2;

    if (pointer.active) {
      sx += (pointer.x - width / 2) * 0.025 * perspective;
      sy += (pointer.y - height / 2) * 0.025 * perspective;
    }

    return {
      sx,
      sy,
      depth: rz,
      alpha: clamp(0.95 - rz * 0.25, 0.08, 0.95),
      radius: point.size * perspective * 5.5 + 0.5
    };
  }

  function draw(time) {
    if (!running) return;
    ctx.clearRect(0, 0, width, height);

    const projected = points.map((p) => project(p, time));

    ctx.lineWidth = 1;
    for (let i = 0; i < projected.length; i += 1) {
      for (let j = i + 1; j < projected.length; j += 1) {
        const a = projected[i];
        const b = projected[j];
        const dx = a.sx - b.sx;
        const dy = a.sy - b.sy;
        const dist = Math.hypot(dx, dy);
        if (dist > settings.linkDistance) continue;
        const fade = 1 - dist / settings.linkDistance;
        const alpha = fade * settings.baseAlpha * ((a.alpha + b.alpha) / 2);
        ctx.strokeStyle = `hsla(${settings.hue}, 86%, 73%, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }
    }

    for (const p of projected) {
      const glow = p.radius * 5;
      const grad = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, glow);
      grad.addColorStop(0, `hsla(${settings.hue}, 96%, 78%, ${p.alpha * 0.95})`);
      grad.addColorStop(1, `hsla(${settings.hue}, 96%, 68%, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, glow, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `hsla(${settings.hue}, 92%, 80%, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    raf = requestAnimationFrame(draw);
  }

  const handleMove = (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.active = true;
  };

  const handleLeave = () => {
    pointer.active = false;
  };

  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (observer) observer.observe(canvas);
  window.addEventListener('resize', resize);
  canvas.addEventListener('pointermove', handleMove);
  canvas.addEventListener('pointerleave', handleLeave);

  resize();
  raf = requestAnimationFrame(draw);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    canvas.removeEventListener('pointermove', handleMove);
    canvas.removeEventListener('pointerleave', handleLeave);
    if (observer) observer.disconnect();
  };
}
