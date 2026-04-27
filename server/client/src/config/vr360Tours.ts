/**
 * 360° equirectangular MP4 VR tours.
 * Primary playback: krpano + videoplayer.js (`/krpano/plugins/videoplayer.js`) with
 * `buildKrpano360VideoXml`. Videos are stored under Firebase Storage `video_vr_tour/`
 * (see project storage rules) and loaded via `getDownloadURL` at runtime.
 * Fall back: local `/videovrtour/…` for offline dev.
 */

export const VR360_TOUR_CHAPTER_ID = '__vr360__';
export const VR360_TOUR_TOPIC_PREFIX = 'tour-';

export type Vr360Player = 'krpano' | 'three';

export interface Vr360TourItem {
  id: string;
  title: string;
  /**
   * Optional local (Vite public/) path for dev when `videoStoragePath` is unset or
   * download URL fails to resolve.
   */
  videoPath: string;
  description?: string;
  /** Storage object path (no leading slash), e.g. `video_vr_tour/360-demo.mp4` */
  videoStoragePath?: string;
  /** Default `krpano` (WebVR + drag); set `three` to force the Three.js sphere player. */
  player?: Vr360Player;
}

/**
 * Aligned to files uploaded under `video_vr_tour/` in Firebase Storage
 * (learnxr-evoneuralai / same bucket the web app uses).
 */
export const VR360_TOURS: Vr360TourItem[] = [
  {
    id: '1',
    title: 'Cell — 360° guided tour (demo)',
    videoPath: '/videovrtour/cell-tour.mp4',
    videoStoragePath: 'video_vr_tour/360-cell-guided-tour-demo.mp4',
    description: 'Equirectangular 360° video',
  },
  {
    id: '2',
    title: 'Spacewalk — 360° VR (BBC Home)',
    videoPath: '/videovrtour/spacewalk.mp4',
    videoStoragePath: 'video_vr_tour/360-vr-spacewalk-bbc.mp4',
    description: 'Equirectangular 360° video',
  },
  {
    id: '3',
    title: 'Taj Mahal — 360° (8K animation)',
    videoPath: '/videovrtour/taj-mahal.mp4',
    videoStoragePath: 'video_vr_tour/360-taj-mahal-8k.mp4',
    description: 'Equirectangular 360° video',
  },
  {
    id: '4',
    title: 'Sample 360° clip',
    videoPath: '/videovrtour/videoplayback.mp4',
    videoStoragePath: 'video_vr_tour/360-videoplayback.mp4',
    description: 'Equirectangular 360° video',
  },
];

export function getVr360TourById(id: string): Vr360TourItem | undefined {
  return VR360_TOURS.find((t) => t.id === id);
}

export function topicIdForVr360TourId(tourId: string): string {
  return `${VR360_TOUR_TOPIC_PREFIX}${tourId}`;
}

export function tourIdFromTopicId(topicId: string | undefined): string | null {
  if (!topicId || !topicId.startsWith(VR360_TOUR_TOPIC_PREFIX)) return null;
  return topicId.slice(VR360_TOUR_TOPIC_PREFIX.length) || null;
}
