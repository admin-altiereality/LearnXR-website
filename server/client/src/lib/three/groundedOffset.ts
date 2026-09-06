import * as THREE from 'three';

/**
 * The translation that centres a model on X/Z and puts its bottom at local Y=0,
 * for a model that is about to be uniformly scaled by `scale`.
 *
 * The scale multiplication is the whole point of this function existing. A
 * node's matrix is T * R * S: the scale applies to the geometry, and the
 * translation is then added in the PARENT's space. An offset taken straight
 * from the unscaled bounding box therefore moves the model by its *authored*
 * size rather than its rendered size, leaving the geometry at
 * `center * (scale - 1)` instead of at the origin.
 *
 * That error is exactly zero when `scale` is 1, which is why models authored
 * near 1 unit always looked correct, and is metres wide for the same model
 * exported in centimetres — which is how an uploaded asset ended up far above
 * the dock while generated ones sat on it.
 *
 * @param box   Bounding box of the model in its own units, before scaling.
 * @param scale Uniform scale about to be applied to the model.
 */
export function groundedOffset(box: THREE.Box3, scale: number): THREE.Vector3 {
  const center = box.getCenter(new THREE.Vector3());
  return new THREE.Vector3(-center.x * scale, -box.min.y * scale, -center.z * scale);
}
