import React from 'react';
import FuturisticBackground from '../Components/FuturisticBackground';
import { Link } from 'react-router-dom';

const previewSections = [
  {
    id: 'overview',
    title: 'Overview of the LearnXR web app',
    description:
      'Get a high-level view of how students, teachers, and school leaders access LearnXR from the browser. Clean navigation, clear entry points, and a unified design language make it easy to get started.',
    images: [
      { src: '/previewimages/webapp.JPG', alt: 'LearnXR web app overview' },
      { src: '/previewimages/webapp1.JPG', alt: 'LearnXR login and dashboard preview' },
    ],
  },
  {
    id: 'dashboards',
    title: 'Personalized dashboards for every role',
    description:
      'Students see upcoming VR lessons, progress, and quizzes. Teachers manage their classes and content. School admins get a bird’s-eye view of adoption and usage across the school.',
    images: [
      { src: '/previewimages/webapp2.JPG', alt: 'LearnXR student dashboard and lessons list' },
      { src: '/previewimages/webapp 2.JPG', alt: 'Alternate view of class and lesson tiles' },
      { src: '/previewimages/webapp3.JPG', alt: 'Lesson detail page highlighting learning objectives' },
      { src: '/previewimages/webapp 3.JPG', alt: 'Student progress and status indicators inside LearnXR' },
    ],
  },
  {
    id: 'management',
    title: 'Class and school management workflows',
    description:
      'Create classes, enroll students, assign teachers, and manage approvals from a single place. LearnXR makes it straightforward for school teams to roll out immersive learning at scale.',
    images: [
      { src: '/previewimages/webapp4.JPG', alt: 'Class management view with roster and assignments' },
      { src: '/previewimages/webapp5.JPG', alt: 'Teacher tools for configuring and launching lessons' },
      { src: '/previewimages/webapp6.JPG', alt: 'School-level management and configuration options' },
      { src: '/previewimages/webapp7.JPG', alt: 'Administrative tools and overview pages' },
    ],
  },
  {
    id: 'experiences',
    title: 'Immersive lessons, galleries, and analytics',
    description:
      'Preview immersive VR lessons, browse galleries of content, and see how learners are engaging. Analytics and reports help teams understand what is working and where to focus next.',
    images: [
      { src: '/previewimages/webapp8.JPG', alt: 'LearnXR immersive lesson gallery and thumbnails' },
      { src: '/previewimages/webapp9.JPG', alt: 'Lesson detail with VR player entry point' },
      { src: '/previewimages/webapp10.JPG', alt: 'Multi-device experience preview across web and XR' },
      { src: '/previewimages/webapp11.JPG', alt: 'Summary reports and analytics for LearnXR usage' },
    ],
  },
];

const WebAppShowcase: React.FC = () => {
  return (
    <FuturisticBackground className="min-h-[100dvh] w-screen overflow-x-hidden flex flex-col">
      <div className="relative z-10 flex-1 w-full px-4 sm:px-6 lg:px-10 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto space-y-8 sm:space-y-10">
          {/* Hero */}
          <header className="space-y-4">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">
              LearnXR Web App
            </p>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground max-w-3xl">
              Explore the LearnXR web experience before you log in.
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-3xl">
              See how students, teachers, and school leaders launch immersive VR lessons, manage
              classes, and track learning outcomes directly from the browser.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                to="/login"
                className="inline-flex items-center rounded-full bg-primary text-primary-foreground text-xs sm:text-sm font-semibold px-4 py-2 shadow-md hover:opacity-95 transition"
              >
                Start exploring as a guest
              </Link>
              <Link
                to="/"
                className="text-xs sm:text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                Back to LearnXR home
              </Link>
            </div>
          </header>

          {/* Hero image row */}
          <section className="rounded-3xl border border-border bg-card/80 backdrop-blur-2xl shadow-xl overflow-hidden">
            <div className="grid md:grid-cols-2 gap-0">
              <div className="relative h-56 sm:h-64 md:h-full bg-muted">
                <img
                  src="/previewimages/webapp1.JPG"
                  alt="LearnXR login and dashboard hero preview"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-background/80 via-transparent to-transparent pointer-events-none" />
              </div>
              <div className="p-4 sm:p-6 lg:p-8 flex flex-col justify-center space-y-3">
                <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                  Designed for schools, teachers, and students.
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  LearnXR brings immersive VR lessons into a familiar web interface. Dashboards,
                  rosters, and lesson libraries are all organized to match how schools already
                  work—so teams can focus on learning, not tooling.
                </p>
                <ul className="text-xs sm:text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                  <li>Role-based dashboards for students, teachers, and administrators</li>
                  <li>Clear entry points into VR lessons and interactive content</li>
                  <li>Built to complement your existing LMS and classroom workflows</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Feature sections */}
          <div className="space-y-10 sm:space-y-12">
            {previewSections.map((section, sectionIndex) => (
              <section
                key={section.id}
                className="rounded-3xl border border-border/80 bg-card/80 backdrop-blur-2xl shadow-lg overflow-hidden"
              >
                <div className="grid md:grid-cols-2 gap-0">
                  <div
                    className={`p-4 sm:p-6 lg:p-8 flex flex-col justify-center space-y-3 ${
                      sectionIndex % 2 === 1 ? 'md:order-2' : ''
                    }`}
                  >
                    <p className="text-[11px] uppercase tracking-[0.18em] text-primary/80 font-semibold">
                      {`0${sectionIndex + 1}`.slice(-2)} · Web experience
                    </p>
                    <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                      {section.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                  <div className={`p-3 sm:p-4 lg:p-5 ${sectionIndex % 2 === 1 ? 'md:order-1' : ''}`}>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      {section.images.map((image) => (
                        <div
                          key={image.src}
                          className="relative rounded-2xl border border-border/70 bg-muted overflow-hidden group"
                        >
                          <img
                            src={image.src}
                            alt={image.alt}
                            loading="lazy"
                            className="w-full h-28 sm:h-32 lg:h-36 object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                          <div className="absolute inset-x-0 bottom-0 px-2.5 py-1.5 bg-gradient-to-t from-background/80 via-background/40 to-transparent">
                            <p className="text-[10px] sm:text-[11px] text-muted-foreground line-clamp-2">
                              {image.alt}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>

          {/* Closing CTA */}
          <section className="rounded-3xl border border-primary/40 bg-primary/10 backdrop-blur-2xl px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1.5">
              <h3 className="text-sm sm:text-base font-semibold text-foreground">
                Ready to experience LearnXR for yourself?
              </h3>
              <p className="text-xs sm:text-sm text-primary-foreground/90 max-w-xl">
                Start a guest session from the login page to try one immersive lesson, or sign up
                as a teacher to unlock the full authoring and classroom toolkit.
              </p>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <Link
                to="/login"
                className="inline-flex items-center rounded-full bg-primary text-primary-foreground text-xs sm:text-sm font-semibold px-4 py-2 shadow-md hover:opacity-95 transition"
              >
                Go to login
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center rounded-full border border-primary/70 text-primary text-xs sm:text-sm font-semibold px-4 py-2 hover:bg-primary/10 transition"
              >
                Create an account
              </Link>
            </div>
          </section>
        </div>
      </div>
    </FuturisticBackground>
  );
};

export default WebAppShowcase;

