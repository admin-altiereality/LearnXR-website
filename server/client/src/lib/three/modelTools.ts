/**
 * modelTools – explode, isolate and section a loaded 3D model.
 *
 * Lifted from `public/krpano/plugins/model_control.xml`, which was already plain
 * Three.js operating on materials and transforms. It lived only inside the
 * krpano player, which is why XRLessonPlayerV3's bottom bar hid its model
 * section: that player reported a part count of zero because it had no way to
 * count. Shared here so both players run one implementation.
 *
 * Three rules the krpano version established, all worth keeping:
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
 * The state this drives — `exploded`, `isolated`, `selected_part_id`, `clip` —
 * is already carried by `TeacherContentState`, so a teacher's manipulation
 * reaches students through the session document with no new fields.
 */

import * as THREE from 'three';

export type ClipAxis = 'x' | 'y' | 'z';

interface CachedPart {
  mesh: THREE.Mesh;
  name: string;
  /** Pristine local position. Every explode is computed from here. */
  home: THREE.Vector3;
  /** Direction the part travels when exploded: model centre -> part centre. */
  direction: THREE.Vector3;
  originalMaterial: THREE.Material | THREE.Material[];
  dimMaterial: THREE.Material | THREE.Material[] | null;
}

interface CachedModel {
  root: THREE.Object3D;
  centre: THREE.Vector3;
  /** Largest dimension, used as the explode distance and the clip range. */
  span: number;
  parts: CachedPart[];
}

export interface ModelTools {
  /** Re-read the scene. Call after assets load or change. */
  collect(roots: THREE.Object3D[]): void;
  /** Separable meshes across all models; below 2 there is nothing to explode. */
  partCount(): number;
  /** `t` is 0..1 — how far apart the parts travel. */
  explode(t: number): void;
  /** Dim everything except `partName`; pass null or `on: false` to restore. */
  isolate(partName: string | null, on: boolean): void;
  /** One cross-section plane. `offset` is -1..1 across the model from its centre. */
  clip(axis: ClipAxis | null, offset: number, renderer: THREE.WebGLRenderer | null): void;
  /** Everything back to how it loaded. */
  reset(renderer: THREE.WebGLRenderer | null): void;
  /** The part under a ray, for picking in-world. */
  pick(raycaster: THREE.Raycaster): { name: string; mesh: THREE.Mesh } | null;
  dispose(): void;
}

export function createModelTools(): ModelTools {
  let models: CachedModel[] = [];

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

  return {
    collect(roots) {
      disposeDimMaterials();
      models = [];

      for (const root of roots) {
        if (!root) continue;
        const box = new THREE.Box3().setFromObject(root);
        const centre = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const span = Math.max(size.x, size.y, size.z) || 1;

        const parts: CachedPart[] = [];
        root.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;

          const partCentre = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
          const direction = partCentre.clone().sub(centre);
          // A part sitting exactly on the centre has no outward direction of its
          // own; send it up rather than leaving it behind when everything moves.
          if (direction.lengthSq() < 1e-8) direction.set(0, 1, 0);
          else direction.normalize();

          parts.push({
            mesh,
            name: String(mesh.name || ''),
            home: mesh.position.clone(),
            direction,
            originalMaterial: mesh.material,
            dimMaterial: null,
          });
        });

        models.push({ root, centre, span, parts });
      }
    },

    partCount() {
      return models.reduce((total, model) => total + model.parts.length, 0);
    },

    explode(t) {
      const amount = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
      for (const model of models) {
        // Nothing to come apart. Moving the only mesh would just relocate the model.
        if (model.parts.length < 2) continue;
        for (const part of model.parts) {
          part.mesh.position.set(
            part.home.x + part.direction.x * amount * model.span,
            part.home.y + part.direction.y * amount * model.span,
            part.home.z + part.direction.z * amount * model.span
          );
        }
      }
    },

    isolate(partName, on) {
      for (const model of models) {
        for (const part of model.parts) {
          const keep = !on || (!!partName && part.name === partName);
          if (keep) {
            if (part.mesh.material !== part.originalMaterial) {
              part.mesh.material = part.originalMaterial;
            }
            continue;
          }
          if (!part.dimMaterial) {
            try {
              const source = part.originalMaterial;
              const dim = Array.isArray(source)
                ? source.map((m) => m.clone())
                : source.clone();
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
      const distance = Number.isFinite(offset) ? offset : 0;
      // Local clipping is off by default and silently does nothing without this.
      if (renderer) renderer.localClippingEnabled = true;

      for (const model of models) {
        let planes: THREE.Plane[] = [];
        if (enabled) {
          const normal = new THREE.Vector3(
            axis === 'x' ? 1 : 0,
            axis === 'y' ? 1 : 0,
            axis === 'z' ? 1 : 0
          );
          // Measured from the model's own centre, so the slider means the same
          // thing whatever the model's size or where it sits in the room.
          const d = model.centre.dot(normal) + distance * model.span * 0.5;
          planes = [new THREE.Plane(normal.clone().negate(), d)];
        }

        for (const part of model.parts) {
          const material = part.mesh.material;
          if (!material) continue;
          const list = Array.isArray(material) ? material : [material];
          for (const m of list) {
            m.clippingPlanes = enabled ? planes : null;
            m.clipShadows = enabled;
            m.needsUpdate = true;
          }
        }
      }
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
      const meshes = models.flatMap((model) => model.parts.map((part) => part.mesh));
      const hit = raycaster.intersectObjects(meshes, false)[0];
      if (!hit) return null;
      const mesh = hit.object as THREE.Mesh;
      return { name: String(mesh.name || ''), mesh };
    },

    dispose() {
      restoreMaterials();
      disposeDimMaterials();
      models = [];
    },
  };
}
