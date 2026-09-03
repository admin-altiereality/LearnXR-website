/**
 * Placement and sizing policy for 3D lesson assets in the krpano scene.
 *
 * All the spatial constants live here rather than as inlined arithmetic, because they were
 * previously spread across a hand-rolled grid in buildKrpanoXml and a fixed target size in
 * measureGlbScale, and the two had no relationship to each other.
 *
 * ## krpano's coordinate space
 *
 * Units are CENTIMETRES and the origin is the viewer's eye:
 *   +x right, +y DOWN, +z forward (away from the viewer)
 *
 * The downward +y is the part that is easy to get wrong, and was: every asset used to be
 * emitted with a negative ty ("ty = -20 - row * 25"), which put it ABOVE eye level, floating
 * overhead rather than set out in front. The floor is at ty = +160 (`controls3d.xml`
 * declares `eyelevel = 160.0`), and `annotation_layer.xml` documents the centimetre scale:
 * "1 unit = hotspotworldscale cm (100 by default, i.e. 1 metre)".
 */

/** Comfortable VR study distance. Under ~1 m causes vergence-accommodation strain; 2-3 m is the sweet spot. */
export const ASSET_DISTANCE_CM = 280;

/**
 * How much of the view one asset should occupy, as an angle rather than an absolute size.
 *
 * Sizing by angle is what makes an asset's apparent size independent of how far away it is
 * placed. The previous fixed 40-unit target meant an author-placed asset at depth 500 looked
 * dramatically smaller than the same asset at depth 180, purely because nothing related the
 * two numbers.
 *
 * 24 deg is ~27% of a 90 deg FOV: prominent enough to study, small enough to take in without
 * moving your head.
 */
export const ASSET_ANGULAR_SIZE_DEG = 24;

/** Clear angular space between neighbouring assets on the arc. */
export const ASSET_ARC_GAP_DEG = 10;

/**
 * How far below the view axis an asset's centre sits, in degrees (+ is down in krpano).
 * A small downward bias reads as "resting on a surface in front of you" rather than hovering.
 */
export const ASSET_ELEVATION_BIAS_DEG = 6;

/** Widest total arc. Beyond this the outermost assets fall outside a comfortable head turn. */
export const ASSET_MAX_ARC_SPAN_DEG = 110;

/** Floor on how small crowding may shrink an asset before it stops being readable. */
export const ASSET_MIN_ANGULAR_SIZE_DEG = 8;

/** Degeneracy guards only — never meant to reshape a legitimate asset. */
const MIN_SCALE = 1e-6;
const MAX_SCALE = 1e6;

const DEG2RAD = Math.PI / 180;

export interface KrpanoXyz {
  tx: number;
  ty: number;
  tz: number;
}

export interface AssetPlacementSpec extends KrpanoXyz {
  /** Degrees, absolute (already includes the view's hlookat). */
  azimuth: number;
  /** Degrees, absolute, positive = down. */
  elevation: number;
  /** Centimetres from the viewer. */
  distance: number;
  /** How wide this asset should render, after any crowding adjustment. */
  angularSize: number;
}

export interface ViewAnchor {
  /** krpano view.hlookat in degrees. */
  hlookat: number;
  /** krpano view.vlookat in degrees, positive = down. */
  vlookat: number;
}

/**
 * The linear size an object must be to subtend `angleDeg` at `distance`.
 * Straight trigonometry: half the object spans tan(angle/2) of the distance.
 */
export function linearSizeForAngularSize(distance: number, angleDeg = ASSET_ANGULAR_SIZE_DEG): number {
  return 2 * distance * Math.tan((angleDeg * DEG2RAD) / 2);
}

/**
 * Scale factor that renders a model of longest-dimension `maxDim` at the target angular size,
 * given where it is actually being placed.
 *
 * Meshy's export scale is wildly inconsistent — two real lesson assets measured 0.06 and
 * 23,380 units across, a ~400,000x spread — so the clamps here have to be wide enough to
 * accommodate both and exist purely to reject NaN/zero. A narrow range silently mangles
 * assets: MAX_SCALE = 50 was crushing the 0.06 model to a 1-degree speck.
 */
export function scaleForAsset(
  maxDim: number,
  distance = ASSET_DISTANCE_CM,
  angularSizeDeg = ASSET_ANGULAR_SIZE_DEG
): number {
  if (!Number.isFinite(maxDim) || maxDim <= 0) return 1;
  const target = linearSizeForAngularSize(distance, angularSizeDeg);
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, target / maxDim));
}

/** Spacing the comfortable-span budget alone would allow, before any no-overlap correction. */
function budgetSpacingForCount(count: number): number {
  if (count <= 1) return 0;
  return Math.min(ASSET_ANGULAR_SIZE_DEG + ASSET_ARC_GAP_DEG, ASSET_MAX_ARC_SPAN_DEG / (count - 1));
}

/**
 * Angular spacing between neighbours on the arc.
 *
 * Never smaller than the assets are wide. Past roughly a dozen assets the size floor would
 * otherwise exceed the compressed spacing and they would overlap again, so beyond that point
 * the arc is allowed to grow past ASSET_MAX_ARC_SPAN_DEG: asking the learner to turn further
 * is a better failure than silently stacking models on top of each other.
 */
function arcSpacingForCount(count: number): number {
  if (count <= 1) return 0;
  return Math.max(budgetSpacingForCount(count), angularSizeForCount(count));
}

/**
 * How wide each asset should render given how many are sharing the arc.
 *
 * Once enough assets are present that spacing has to compress below the comfortable span,
 * keeping them at full size would put them back into overlap — the exact failure the arc is
 * meant to make impossible. So crowding shrinks the assets rather than letting them collide:
 * the no-overlap property then holds at any count, by construction rather than by luck.
 */
export function angularSizeForCount(count: number): number {
  if (count <= 1) return ASSET_ANGULAR_SIZE_DEG;
  const spacing = budgetSpacingForCount(count);
  return Math.max(ASSET_MIN_ANGULAR_SIZE_DEG, Math.min(ASSET_ANGULAR_SIZE_DEG, spacing - ASSET_ARC_GAP_DEG));
}

/**
 * Converts a spherical placement into krpano's cartesian hotspot coordinates.
 * `elevationDeg` is positive-down, matching krpano's atv/vlookat convention.
 */
export function sphericalToKrpanoXyz(azimuthDeg: number, elevationDeg: number, distance: number): KrpanoXyz {
  const az = azimuthDeg * DEG2RAD;
  const el = elevationDeg * DEG2RAD;
  const horizontal = distance * Math.cos(el);
  return {
    tx: round(horizontal * Math.sin(az)),
    ty: round(distance * Math.sin(el)),
    tz: round(horizontal * Math.cos(az)),
  };
}

/**
 * Lays `count` assets out on a single horizontal arc, centred on where the learner is
 * looking when the lesson opens.
 *
 * An arc rather than a grid, because every asset then sits at the SAME distance: they share
 * an apparent size, and as long as the angular spacing is at least the angular size, none can
 * occlude another — the property is guaranteed by the geometry instead of hoped for. The old
 * 3-wide grid stepped tz per row, so row 1 was both further away and smaller, and measurably
 * overlapped row 0 in azimuth and elevation.
 *
 * Anchoring to the view rather than to world axes means assets land in front of the learner
 * for every lesson, including ones that author their own intro lookat.
 */
export function computeAssetArcPlacements(
  count: number,
  view: ViewAnchor,
  distance = ASSET_DISTANCE_CM
): AssetPlacementSpec[] {
  if (count <= 0) return [];

  // Compress rather than exceed the comfortable turn once there are enough assets to need it.
  const spacing = arcSpacingForCount(count);
  const span = spacing * (count - 1);
  const elevation = view.vlookat + ASSET_ELEVATION_BIAS_DEG;
  const angularSize = angularSizeForCount(count);

  return Array.from({ length: count }, (_, i) => {
    // A single asset resolves to offset 0 — dead centre in the entrance view.
    const azimuth = view.hlookat + (-span / 2 + i * spacing);
    return {
      azimuth: round(azimuth),
      elevation: round(elevation),
      distance,
      angularSize,
      ...sphericalToKrpanoXyz(azimuth, elevation, distance),
    };
  });
}

/** Two decimals is well under a millimetre at these distances and keeps the XML readable. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
