/**
 * ClassLaunchRouter
 * -----------------
 * The single place that reacts to a teacher launching content to the class.
 *
 * Previously this logic lived in three places — ClassSessionContext (licensed
 * content only), Lessons.jsx (curriculum / vr360 / user_generated) and
 * StudentDashboard (its Join button) — which meant a student sitting on any
 * other page was never pulled into the lesson. Mounting this once inside
 * ClassSessionProvider makes launches work app-wide.
 *
 * Renders nothing.
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useClassSession } from '../../contexts/ClassSessionContext';
import { useLesson } from '../../contexts/LessonContext';
import { buildCreateSceneActiveLesson } from '../../utils/buildCreateSceneActiveLesson';
import { getVr360TourById, VR360_TOUR_CHAPTER_ID } from '../../config/vr360Tours';
import { resolvePlayerRoute } from '../../lib/classroom/resolvePlayerRoute';
import type { LessonChapter, LessonTopic } from '../../contexts/LessonContext';

const LICENSED_TYPES = ['licensed_3d', 'licensed_embed', 'licensed_link'];
/** Survives a reload so returning to the same launch does not re-navigate. */
const HANDLED_KEY = 'learnxr_handled_launch_key';

function readHandled(): string | null {
  try {
    return sessionStorage.getItem(HANDLED_KEY);
  } catch {
    return null;
  }
}

function writeHandled(key: string) {
  try {
    sessionStorage.setItem(HANDLED_KEY, key);
  } catch {
    /* ignore */
  }
}

export const ClassLaunchRouter = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { joinedSession, joinedSessionId, isAdmitted } = useClassSession();
  const { startLesson: contextStartLesson } = useLesson();
  const inFlightRef = useRef<string | null>(null);

  const launched = joinedSession?.launched_lesson ?? null;
  const scene = joinedSession?.launched_scene ?? null;
  // Hosts drive the class from their own player; never redirect them.
  //
  // `isAdmitted` is the access check. A student the teacher removed keeps their
  // joined session while a rejoin request is pending — without this they were
  // pulled straight back into the lesson the moment they asked, with no
  // approval from anyone.
  const isStudentInSession =
    Boolean(joinedSessionId) &&
    Boolean(user?.uid) &&
    joinedSession?.teacher_uid !== user?.uid &&
    isAdmitted;

  // ---- Launched lesson -----------------------------------------------------
  useEffect(() => {
    if (!launched || !joinedSessionId || !isStudentInSession) return;

    const lessonType = String(launched.lesson_type ?? 'curriculum');

    // Dedupe on launch_id so relaunching the SAME topic still re-opens it.
    const identity =
      launched.launch_id || `${launched.chapter_id}_${launched.topic_id}_${lessonType}`;
    const key = `${joinedSessionId}:${identity}`;
    if (readHandled() === key || inFlightRef.current === key) return;

    // Licensed content opens in the Immersive STEM viewer.
    if (LICENSED_TYPES.includes(lessonType)) {
      if (!launched.licensed_content_id) return;
      inFlightRef.current = key;
      writeHandled(key);
      try {
        sessionStorage.setItem('learnxr_joined_session_id', joinedSessionId);
      } catch {
        /* ignore */
      }
      navigate(`/immersive-stem/${encodeURIComponent(launched.licensed_content_id)}`);
      return;
    }

    // 360° video tours.
    if (lessonType === 'vr360_video' || launched.chapter_id === VR360_TOUR_CHAPTER_ID) {
      const tid =
        launched.vr360_tour_id ||
        (typeof launched.topic_id === 'string' && launched.topic_id.startsWith('tour-')
          ? launched.topic_id.replace(/^tour-/, '')
          : null);
      const tour = tid ? getVr360TourById(tid) : undefined;
      if (!tour) return;
      inFlightRef.current = key;
      writeHandled(key);
      try {
        sessionStorage.setItem(
          'learnxr_vr360_tour',
          JSON.stringify({
            tourId: tour.id,
            title: tour.title,
            videoPath: tour.videoPath,
            videoStoragePath: tour.videoStoragePath,
            player: tour.player,
            fromClassSession: true,
          })
        );
        sessionStorage.setItem('learnxr_joined_session_id', joinedSessionId);
        setTimeout(() => navigate('/vr360-videotour'), 200);
      } catch (err) {
        console.error('ClassLaunchRouter: failed to open 360 tour:', err);
        inFlightRef.current = null;
      }
      return;
    }

    // Curriculum / user-generated lessons: fetch the bundle, then open the
    // player the teacher chose at launch.
    inFlightRef.current = key;
    let cancelled = false;

    (async () => {
      try {
        // Shared with the player, which builds the same payload for itself when
        // a topic changes mid-class. Two copies of this transformation were how
        // a teacher ended up reloading the topic they had just left.
        const { buildActiveLesson } = await import('../../lib/lesson/buildActiveLesson');
        const fullLessonData = await buildActiveLesson(launched);
        if (cancelled) return;
        if (!fullLessonData) {
          inFlightRef.current = null;
          return;
        }
        const cleanChapter = fullLessonData.chapter;
        const cleanTopic = fullLessonData.topic;

        writeHandled(key);
        sessionStorage.setItem('activeLesson', JSON.stringify(fullLessonData));
        sessionStorage.setItem('learnxr_joined_session_id', joinedSessionId);
        if (typeof contextStartLesson === 'function') {
          // The player reads the richer payload from sessionStorage; LessonContext
          // only needs the identifying fields, so narrow at this boundary.
          contextStartLesson(
            cleanChapter as unknown as LessonChapter,
            cleanTopic as unknown as LessonTopic
          );
        }
        /*
          Navigate only if the student is not already in the player.

          A chapter is several topics, and every launch used to navigate.
          Navigating to the route you are already on still remounts the player,
          which disposes the renderer and ends the WebXR session — so a class
          working through a chapter was thrown out of their headsets between
          every topic.

          The lesson data is in sessionStorage either way; a running player
          watches `launched_lesson.launch_id` and swaps its content in place. The
          navigation is only needed to GET to the player, so it happens only when
          the student is somewhere else.
        */
        const route = resolvePlayerRoute(launched);
        if (window.location.pathname === route) {
          // Already there. The player takes it from here.
          return;
        }
        // Small delay so third-party iframes (Firebase Auth) settle first.
        setTimeout(() => navigate(route), 200);
      } catch (err) {
        console.error('ClassLaunchRouter: failed to open launched lesson:', err);
        inFlightRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [launched, joinedSessionId, isStudentInSession, navigate, contextStartLesson]);

  // ---- Launched scene (Create page) ---------------------------------------
  useEffect(() => {
    if (!scene || scene.type !== 'create_scene' || !joinedSessionId || !isStudentInSession) return;
    const key = `${joinedSessionId}:scene_${
      scene.skybox_image_url || scene.skybox_id || 'default'
    }_${scene.meshy_glb_url || ''}`;
    if (readHandled() === key || inFlightRef.current === key) return;
    inFlightRef.current = key;
    try {
      const fullLessonData = buildCreateSceneActiveLesson(scene);
      writeHandled(key);
      sessionStorage.setItem('activeLesson', JSON.stringify(fullLessonData));
      sessionStorage.setItem('learnxr_launched_scene', JSON.stringify(scene));
      sessionStorage.setItem('learnxr_joined_session_id', joinedSessionId);
      if (typeof contextStartLesson === 'function') {
        contextStartLesson(
          fullLessonData.chapter as unknown as LessonChapter,
          fullLessonData.topic as unknown as LessonTopic
        );
      }
      // A launched scene carries no player of its own; follow the lesson the
      // teacher last launched so the class does not split between players.
      setTimeout(() => navigate(resolvePlayerRoute(joinedSession?.launched_lesson)), 200);
    } catch (err) {
      console.error('ClassLaunchRouter: failed to open launched scene:', err);
      inFlightRef.current = null;
    }
  }, [scene, joinedSessionId, isStudentInSession, navigate, contextStartLesson, joinedSession?.launched_lesson]);

  return null;
};
