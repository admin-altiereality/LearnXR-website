import { motion, useReducedMotion } from 'framer-motion';
import AnimatedSection from '../../AnimatedSection';
import { xrClassroom } from '../data/landingContent';
import { SectionHeading } from '../ui/SectionHeading';

export const XRClassroomSection = () => {
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="xr-classroom"
      aria-labelledby="xr-classroom-heading"
      className="relative z-10 overflow-hidden px-4 py-16 sm:px-8 sm:py-28 lg:px-12"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/40 via-transparent to-transparent" aria-hidden />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2">
        <AnimatedSection animation="fadeRight">
          <SectionHeading
            id="xr-classroom-heading"
            eyebrow={xrClassroom.eyebrow}
            title={xrClassroom.title}
            description={xrClassroom.description}
            align="left"
            className="max-w-xl"
          />
        </AnimatedSection>

        <div className="relative mx-auto aspect-[4/3] w-full max-w-xl">
          <motion.img
            animate={reduceMotion ? undefined : { y: [0, -12, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            src={xrClassroom.imagePrimary}
            alt="XR classroom experience"
            loading="lazy"
            className="absolute inset-0 h-full w-full rounded-3xl object-cover shadow-2xl ring-1 ring-white/15"
            width={720}
            height={540}
          />
          <motion.img
            animate={reduceMotion ? undefined : { y: [0, 14, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            src={xrClassroom.imageSecondary}
            alt=""
            loading="lazy"
            className="absolute -bottom-6 -left-4 w-[42%] max-w-[220px] rounded-2xl object-cover shadow-xl ring-1 ring-white/20 sm:-left-8"
            width={220}
            height={220}
          />
        </div>
      </div>
    </section>
  );
};
