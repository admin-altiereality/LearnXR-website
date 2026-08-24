/**
 * AnnotationOverlay
 * -----------------
 * Renders teacher marker strokes as an SVG layer over the panorama.
 *
 * Strokes are stored in sphere coordinates, so on every view change we project
 * each point back to screen space with krpano's `spheretoscreen`. Points more
 * than ~80 degrees from the view centre are culled AND the polyline is split at
 * the cull, otherwise points behind the camera project to bogus coordinates and
 * smear a line across the whole view.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnnotationStroke, TeacherAnnotations } from '../../types/lms';
import {
  angularDistance,
  annotationNow,
  isStrokeExpired,
  laserOpacity,
  splitAtSeam,
} from '../../lib/annotations/sphereGeometry';
import { getLastView, onViewChange } from '../../lib/krpano/viewChangeBus';

/** Beyond this angle from the view centre a point is behind/way off screen. */
const CULL_DEGREES = 80;

interface KrpanoLike {
  get?: (name: string) => unknown;
  spheretoscreen?: (ath: number, atv: number) => { x: number; y: number } | null;
}

interface AnnotationOverlayProps {
  annotations: TeacherAnnotations | null | undefined;
  /** The live krpano interface object. */
  viewer: KrpanoLike | null;
  /** Local strokes not yet published (the teacher's own in-progress drawing). */
  localStrokes?: AnnotationStroke[];
}

interface Segment {
  key: string;
  d: string;
  color: string;
  width: number;
  opacity: number;
}

export const AnnotationOverlay = ({ annotations, viewer, localStrokes = [] }: AnnotationOverlayProps) => {
  const [tick, setTick] = useState(0);
  const rafRef = useRef<number | null>(null);

  // Re-project on every view change, rAF-throttled so a fast drag does not
  // trigger one React render per krpano tick.
  useEffect(() => {
    const schedule = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setTick((n) => n + 1);
      });
    };
    const unsub = onViewChange(schedule);
    const onResize = () => schedule();
    window.addEventListener('resize', onResize);
    schedule();
    return () => {
      unsub();
      window.removeEventListener('resize', onResize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Every stroke now fades and vanishes on its own, so tick whenever ANY stroke is live.
  // This used to be gated on laser-only and would never run for ink.
  const hasLiveStroke =
    Boolean(annotations?.laser) ||
    (annotations?.strokes?.length ?? 0) > 0 ||
    localStrokes.length > 0;
  useEffect(() => {
    if (!hasLiveStroke) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 80);
    return () => window.clearInterval(id);
  }, [hasLiveStroke]);

  const strokes = useMemo(() => {
    const now = annotationNow();
    const all: AnnotationStroke[] = [
      ...(annotations?.strokes ?? []),
      ...(annotations?.laser ? [annotations.laser] : []),
      ...localStrokes,
    ];
    return all.filter((s) => s && s.points?.length > 0 && !isStrokeExpired(s, now));
  }, [annotations, localStrokes]);

  const segments = useMemo<Segment[]>(() => {
    if (!viewer?.spheretoscreen || strokes.length === 0) return [];
    const view = getLastView() ?? {
      hlookat: Number(viewer.get?.('view.hlookat') ?? 0),
      vlookat: Number(viewer.get?.('view.vlookat') ?? 0),
      fov: Number(viewer.get?.('view.fov') ?? 90),
    };
    const centre = { a: view.hlookat, v: view.vlookat };
    const fovScale = 90 / (view.fov || 90);
    const now = annotationNow();
    const out: Segment[] = [];

    strokes.forEach((stroke) => {
      const opacity = laserOpacity(stroke, now);
      if (opacity <= 0) return;

      splitAtSeam(stroke.points).forEach((run, runIndex) => {
        // Split again wherever a point is culled, so the line breaks instead of
        // jumping across the screen.
        let current: string[] = [];
        let partIndex = 0;
        const flush = () => {
          if (current.length >= 2) {
            out.push({
              key: `${stroke.id}_${runIndex}_${partIndex}`,
              d: current.join(' '),
              color: stroke.color,
              width: Math.max(1.5, stroke.width * fovScale),
              opacity,
            });
            partIndex += 1;
          }
          current = [];
        };

        run.forEach((pt) => {
          if (angularDistance(centre, pt) > CULL_DEGREES) {
            flush();
            return;
          }
          const scr = viewer.spheretoscreen!(pt.a, pt.v);
          if (!scr || !Number.isFinite(scr.x) || !Number.isFinite(scr.y)) {
            flush();
            return;
          }
          current.push(`${current.length === 0 ? 'M' : 'L'}${scr.x.toFixed(1)},${scr.y.toFixed(1)}`);
        });
        flush();
      });
    });
    return out;
    // `tick` is the recomputation trigger: it advances on every krpano view change and
    // on the laser fade interval, so strokes are re-projected as the view moves.
  }, [strokes, viewer, tick]);

  if (segments.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-annot h-full w-full"
      aria-hidden="true"
    >
      {segments.map((seg) => (
        <path
          key={seg.key}
          d={seg.d}
          fill="none"
          stroke={seg.color}
          strokeWidth={seg.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={seg.opacity}
          style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.55))' }}
        />
      ))}
    </svg>
  );
};
