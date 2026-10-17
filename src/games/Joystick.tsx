import { useRef, useState } from 'react';

export type Vec = { x: number; y: number };

export default function Joystick({ onMove, size = 130 }: { onMove: (v: Vec) => void; size?: number }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState<Vec>({ x: 0, y: 0 });
  const idRef = useRef<number | null>(null);

  const update = (cx: number, cy: number) => {
    const el = baseRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let dx = cx - (r.left + r.width / 2);
    let dy = cy - (r.top + r.height / 2);
    const max = size / 2;
    const d = Math.hypot(dx, dy);
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    setKnob({ x: dx, y: dy });
    onMove({ x: dx / max, y: dy / max });
  };

  return (
    <div
      ref={baseRef}
      className="relative touch-none select-none rounded-full border-2 border-white/40 bg-white/10 backdrop-blur-sm"
      style={{ width: size, height: size }}
      onPointerDown={(e) => {
        idRef.current = e.pointerId;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => { if (idRef.current === e.pointerId) update(e.clientX, e.clientY); }}
      onPointerUp={() => { idRef.current = null; setKnob({ x: 0, y: 0 }); onMove({ x: 0, y: 0 }); }}
      onPointerCancel={() => { idRef.current = null; setKnob({ x: 0, y: 0 }); onMove({ x: 0, y: 0 }); }}
    >
      <div
        className="pointer-events-none absolute rounded-full bg-white/70 shadow-lg"
        style={{
          width: size * 0.42, height: size * 0.42,
          left: size / 2 - size * 0.21 + knob.x, top: size / 2 - size * 0.21 + knob.y,
        }}
      />
    </div>
  );
}

export function HoldButton({
  label, onDown, onUp, className = '',
}: { label: React.ReactNode; onDown: () => void; onUp?: () => void; className?: string }) {
  return (
    <button
      className={`touch-none select-none rounded-full font-bold text-white shadow-lg active:scale-95 ${className}`}
      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onDown(); }}
      onPointerUp={(e) => { e.preventDefault(); onUp?.(); }}
      onPointerLeave={() => onUp?.()}
      onPointerCancel={() => onUp?.()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

export const isTouch = () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
