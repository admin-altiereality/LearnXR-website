/**
 * modelTools – explode, isolate and section the 3D models in a lesson.
 *
 * Lifted from `public/krpano/plugins/model_control.xml`, which was already plain
 * Three.js operating on materials and transforms, and shared so both players run
 * one implementation.
 *
 * Rules carried over from the krpano version, all worth keeping:
 *
 *   - Every transform derives from a CACHED home position, never from the
 *     current one. Deriving from current accumulates drift, so repeatedly
 *     nudging the explode slider would slowly tear a model apart permanently.
 *   - A single-mesh model is left completely alone. There is nothing to
 *     separate, and moving the only mesh just relocates the whole object.
 *   - Selection is shown by tinting, not by scaling. Scaling the chosen part
 *     destroys the authored placement scale, and makes a synced scale
 *     impossible to express.
 *
 * Two things this adds, both needed once a lesson can hold more than one asset:
 *
 *   - **A target.** The teacher selects one asset and explode/section act on
 *     that one alone; with nothing selected they act on everything, which is
 *     what a single-asset lesson wants. Parts are addressed by an id that
 *     includes the model, because mesh names are routinely blank or repeated
 *     across assets, and a name alone would isolate the wrong piece.
 *   - **Model-local geometry.** Every distance is measured in the model's OWN
 *     space rather than the world. Measuring in the world was wrong twice over:
 *     the numbers were captured before the layout system scaled and placed the
 *     asset, so they described a model that no longer existed, and the explode
 *     offset was then added to mesh positions expressed in the model's authored
 *     units. For anything not authored at metre scale that made explode
 *     invisible and put the section plane nowhere near the model.
 *
 * The state this drives — `exploded`, `isolated`, `selected_part_id`, `clip` —
 * is carried by `TeacherContentState`, so a teacher's manipulation reaches
 * students through the session document.
 */

import * as THREE from 'three';

export type ClipAxis = 'x' | 'y' | 'z';

export interface ModelSummary {
  key: string;
  name: string;
  partCount: number;
}

export interface PickedPart {
  /** Which asset the part belongs to. */
  key: string;
  /** Stable id of the part, unique across the scene. */
  partId: string;
  /** Display name, which may be blank — never use it to address a part. */
  name: string;
  mesh: THREE.Mesh;
}

interface CachedPart {
  mesh: THREE.Mesh;
  /** `${modelKey}#${index}` — stable, and unique even when meshes are unnamed. */
  id: string;
  name: string;
  /** Pristine local position. Every explode is computed from here. */
  home: THREE.Vector3;
  /** Direction the part travels, in the MODEL's space: centre -> part centre. */
  direction: THREE.Vector3;
  /**
   * Converts a displacement in the model's space into the mesh's parent space.
   * Precomputed because the internal hierarchy never changes — only the root's
   * own transform does, and this is deliberately independent of that.
   */
  toParent: THREE.Matrix3;
  originalMaterial: THREE.Material | THREE.Material[];
  dimMaterial: THREE.Material | THREE.Material[] | null;
}

interface CachedModel {
  key: string;
  name: string;
  root: THREE.Object3D;
  /** Centre of the model in its own space. */
  centre: THREE.Vector3;
  /** Largest dimension in the model's own space: explode distance and clip range. */
  span: number;
  parts: CachedPart[];
  /** Reused so an active cut can be re-derived without reallocating. */
  plane: THREE.Plane;
}

export interface ModelTools {
  /** Re-read the scene. Call after assets load or change. */
  collect(roots: THREE.Object3D[]): void;
  /** Every asset present, for a picker. */
  list(): ModelSummary[];
  /** Target one asset, or null for all of them. */
  select(key: string | null): void;
  selectedKey(): string | null;
  /** Separable meshes in the current target; below 2 there is nothing to explode. */
  partCount(): number;
  /** `t` is 0..1 — how far apart the parts travel. */
  explode(t: number): void;
  /** Dim every part except `partId`; pass null or `on: false` to restore. */
  isolate(partId: string | null, on: boolean): void;
  /** One cross-section plane. `offset` is -1..1 across the model from its centre. */
  clip(axis: ClipAxis | null, offset: number, renderer: THREE.WebGLRenderer | null): void;
  /** Keeps an active cut on the model when the model itself is moved. */
  update(): void;
  /** Everything back to how it loaded. */
  reset(renderer: THREE.WebGLRenderer | null): void;
  /** The part under a ray, for picking in-world. */
  pick(raycaster: THREE.Raycaster): PickedPart | null;
  dispose(): void;
}

/**
 * Bounding box of `root` expressed in root's own space.
 *
 * `Box3.setFromObject` reports world coordinates, which for a model that has
 * been scaled and moved onto the dock describes where it currently sits rather
 * than how big it is. Everything here has to be independent of placement, so
 * the geometry is gathered through the root's inverse instead.
 */
function localBounds(root: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const toRoot = new THREE.Matrix4();

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const geometryBox = mesh.geometry.boundingBox;
    if (!geometryBox) return;
    toRoot.multiplyMatrices(rootInverse, mesh.matrixWorld);
    box.union(geometryBox.clone().applyMatrix4(toRoot));
  });

  return box;
}

/** Centre of one mesh's geometry, in the root's space. */
function localCentreOf(mesh: THREE.Mesh, rootInverse: THREE.Matrix4): THREE.Vector3 {
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  const geometryBox = mesh.geometry.boundingBox;
  if (!geometryBox) return new THREE.Vector3();
  const toRoot = new THREE.Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld);
  return geometryBox.clone().applyMatrix4(toRoot).getCenter(new THREE.Vector3());
}

export function createModelTools(): ModelTools {
  let models: CachedModel[] = [];
  let selected: string | null = null;
  let activeClip: { axis: ClipAxis; offset: number } | null = null;

  /** Models the controls act on: the selection, or everything. */
  const targets = (): CachedModel[] => {
    if (!selected) return models;
    const model = models.find((m) => m.key === selected);
    return model ? [model] : models;
  };

  const restoreMaterials = () => {
    for (const model of models) {
      for (const part of model.parts) {
        if (part.mesh.material !== part.originalMaterial) {
          part.mesh.material = part.originalMaterial;
        }
      }
    }
  };

  const disposeDimMaterials = () => {
    for (const model of models) {
      for (const part of model.parts) {
        const dim = part.dimMaterial;
        if (!dim) continue;
        if (Array.isArray(dim)) dim.forEach((m) => m.dispose());
        else dim.dispose();
        part.dimMaterial = null;
      }
    }
  };

  /** Point the model's cut plane at where the model currently is in the world. */
  const refreshPlane = (model: CachedModel) => {
    if (!activeClip) return;
    const axis = activeClip.axis;
    const normal = new THREE.Vector3(
      axis === 'x' ? 1 : 0,
      axis === 'y' ? 1 : 0,
      axis === 'z' ? 1 : 0
    );
    // Measured from the model's own centre, so the slider means the same thing
    // whatever the model's size or where it sits in the room.
    const cutPoint = model.centre
      .clone()
      .addScaledVector(normal, activeClip.offset * model.span * 0.5)
      .applyMatrix4(model.root.matrixWorld);
    // Clipping planes are world-space, so the normal has to be rotated with the
    // model. Re-derived rather than cached: a grabbed model turns as it moves.
    const worldNormal = normal.clone().transformDirection(model.root.matrixWorld).normalize();
    model.plane.setFromNormalAndCoplanarPoint(worldNormal.negate(), cutPoint);
  };

  return {
    collect(roots) {
      disposeDimMaterials();
      const previous = selected;
      models = [];

      const usedKeys = new Set<string>();

      roots.forEach((root, rootIndex) => {
        if (!root) return;
        // Bounds are read off the matrices, so they have to be current.
        root.updateMatrixWorld(true);

        // Keys address a model in published state, so two models must never
        // share one. Names normally come from the asset id and are unique, but
        // the same asset linked twice would collide and silently make every
        // control act on both.
        let key = String(root.name || root.uuid || `asset_${rootIndex}`);
        if (usedKeys.has(key)) key = `${key}~${rootIndex}`;
        usedKeys.add(key);
        const box = localBounds(root);
        const centre = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const span = Math.max(size.x, size.y, size.z) || 1;
        const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();

        const parts: CachedPart[] = [];
        root.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh || !mesh.geometry) return;

          const direction = localCentreOf(mesh, rootInverse).sub(centre);
          // A part sitting exactly on the centre has no outward direction of its
          // own; send it up rather than leaving it behind when everything moves.
          if (direction.lengthSq() < 1e-8) direction.set(0, 1, 0);
          else direction.normalize();

          // Model space -> this mesh's parent space, for the explode offset.
          const parent = mesh.parent;
          const toParent = new THREE.Matrix3();
          if (parent) {
            const parentToRoot = new THREE.Matrix4().multiplyMatrices(
              rootInverse,
              parent.matrixWorld
            );
            toParent.setFromMatrix4(parentToRoot.invert());
          } else {
            toParent.identity();
          }

          parts.push({
            mesh,
            id: `${key}#${parts.length}`,
            name: String(mesh.name || ''),
            home: mesh.position.clone(),
            direction,
            toParent,
            originalMaterial: mesh.material,
            dimMaterial: null,
          });
        });

        models.push({
          key,
          name: root.name || key,
          root,
          centre,
          span,
          parts,
          plane: new THREE.Plane(),
        });
      });

      // Keep the teacher's choice across a reload; otherwise target the first
      // asset, so the toolbar always reports a real part count rather than the
      // sum across a scene the controls are not all acting on.
      selected =
        previous && models.some((m) => m.key === previous)
          ? previous
          : (models[0]?.key ?? null);
    },

    list() {
      return models.map((model) => ({
        key: model.key,
        name: model.name,
        partCount: model.parts.length,
      }));
    },

    select(key) {
      selected = key && models.some((m) => m.key === key) ? key : null;
    },

    selectedKey() {
      return selected;
    },

    partCount() {
      return targets().reduce((total, model) => total + model.parts.length, 0);
    },

    explode(t) {
      const amount = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
      const offset = new THREE.Vector3();
      for (const model of targets()) {
        // Nothing to come apart. Moving the only mesh would just relocate the model.
        if (model.parts.length < 2) continue;
        for (const part of model.parts) {
          offset
            .copy(part.direction)
            .multiplyScalar(amount * model.span)
            .applyMatrix3(part.toParent);
          part.mesh.position.copy(part.home).add(offset);
        }
      }
    },

    isolate(partId, on) {
      // Dims across the whole scene, not just the target: isolating a part is a
      // teacher saying "look at this", and a second asset left at full strength
      // beside it defeats that.
      for (const model of models) {
        for (const part of model.parts) {
          const keep = !on || (!!partId && part.id === partId);
          if (keep) {
            if (part.mesh.material !== part.originalMaterial) {
              part.mesh.material = part.originalMaterial;
            }
            continue;
          }
          if (!part.dimMaterial) {
            try {
              const source = part.originalMaterial;
              const dim = Array.isArray(source) ? source.map((m) => m.clone()) : source.clone();
              const list = Array.isArray(dim) ? dim : [dim];
              for (const material of list) {
                material.transparent = true;
                material.opacity = 0.15;
                // Dimmed parts must not occlude the isolated one behind them.
                material.depthWrite = false;
              }
              part.dimMaterial = dim;
            } catch {
              part.dimMaterial = null;
            }
          }
          if (part.dimMaterial) part.mesh.material = part.dimMaterial;
        }
      }
    },

    clip(axis, offset, renderer) {
      const enabled = axis === 'x' || axis === 'y' || axis === 'z';
      activeClip = enabled
        ? { axis: axis as ClipAxis, offset: Number.isFinite(offset) ? offset : 0 }
        : null;
      // Local clipping is off by default and silently does nothing without this.
      if (renderer) renderer.localClippingEnabled = true;

      const cut = new Set(targets().map((model) => model.key));
      for (const model of models) {
        const on = enabled && cut.has(model.key);
        if (on) refreshPlane(model);
        const planes = on ? [model.plane] : null;
        for (const part of model.parts) {
          const material = part.mesh.material;
          if (!material) continue;
          const list = Array.isArray(material) ? material : [material];
          for (const m of list) {
            m.clippingPlanes = planes;
            m.clipShadows = on;
            m.needsUpdate = true;
          }
        }
      }
    },

    update() {
      // Costs nothing on the overwhelmingly common path of no active cut.
      if (!activeClip) return;
      for (const model of targets()) refreshPlane(model);
    },

    reset(renderer) {
      this.explode(0);
      this.isolate(null, false);
      this.clip(null, 0, renderer);
    },

    /**
     * The part under a ray.
     *
     * This is what makes "label the part" possible: the student's answer is the
     * sub-mesh they picked, rather than a lettered option on a panel.
     */
    pick(raycaster) {
      for (const model of models) {
        const meshes = model.parts.map((part) => part.mesh);
        const hit = raycaster.intersectObjects(meshes, false)[0];
        if (!hit) continue;
        const mesh = hit.object as THREE.Mesh;
        const part = model.parts.find((p) => p.mesh === mesh);
        if (!part) continue;
        return { key: model.key, partId: part.id, name: part.name, mesh };
      }
      return null;
    },

    dispose() {
      restoreMaterials();
      disposeDimMaterials();
      models = [];
      selected = null;
      activeClip = null;
    },
  };
}
