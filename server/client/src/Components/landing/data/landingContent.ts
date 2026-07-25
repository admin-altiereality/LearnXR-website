export const META_APP_DOWNLOAD_URL =
  'https://auth.meta.com/?redirect_uri=https%3A%2F%2Fauth.meta.com%2Foidc%2F%3Fapp_id%3D800455417652954%26nonce%3DAdQi5LEM6riWKxzTZrD0bXJ1x2I%26redirect_uri%3Dhttps%253A%252F%252Fwww.meta.com%252Foidc%252Fcallback%252F%26response_type%3Dcode%26scope%3Dopenid%26state%3DATl_hLfLHREpPWPtt3WGoMCoLcBaqU8PvEZjbeQWIGRgLWgOev5tz_fl9manJNSAPMN2H73Q6rQHFUBhrQhNW23YJhse2Vq9JcBE1I-hrqG5GmgWDwYPYObI0uYjqzKFi5GYf0YAqVx8prXp7SCZPmHJL6MuwRG4a8KtB_14Va6yN6kD7cGeaGX_EOfykGhTVWCH4ycS_xkuvOtMy47LcyVcJy1wqoeYti0XkcQDopwNwcBYegAmmKKkGZ4y-Gy6CrjXel0NT9auT0-XgnM7ipvi8oD4dgsZhmhH2A0RrTmYKbgthvzNX4u4eaPdp3s7ZsapTbT1Qwe7sI1F0VkhDz0iymReBWsFy-kTQZzwnsA2_FWn35R6a2TgkrpFSWlEc9mECl2Wcnzar9H8t8g2T9bvhOrufnfL9xWOB7Z9x9epxZuBAYaCEqjKDRGmpPLQ35BM5D7lxVWAVh2uI8WbelDs4hfZAcWrwCT1PQP8XjxyT6Zy5jsZDYrN7wQWHZEjLq8NPRnsLm50B-rA2X895y1wRE5B0gIXTw&source_app_id=800455417652954&utm_source=meta.com&rcs=ATnXRqGr93UwpI9ZXBhY2ROYeLeHP3u5y1xAGYXxiHBfSMYPM_4CTlbSrsmBVJjcsmam6PW_Ap2ywRC7oBsHqcEDqoxb7tMNsULXx2EmhRzpZY8BwFGtYHXUE3bSo4bRIFOBqLi36jmZ6DCMMGWQxWaCN_xACfcXjvYwD0GybMgRGFZS0pR7dlDFP8s';

export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.altiereality1.lexrn&hl=en&gl=US&pli=1';

export const SIDEQUEST_URL = 'https://sidequestvr.com/app/17713/lexrn-app-for-students';

export const navLinks = [
  { label: 'Case Studies', to: '/case-studies', kind: 'link' as const },
  { label: 'Partners', to: '/channel-partners', kind: 'link' as const },
  { label: 'Book a Demo', kind: 'demo' as const },
  { label: 'Explore platform', to: '/web-preview', kind: 'link' as const },
  { label: 'Login', kind: 'login' as const },
];

export const hero = {
  tagline: 'Redefining Learning with XR + AI.',
  supporting:
    'An AI-powered XR learning platform that turns classrooms into immersive worlds — from K-12 STEM to humanities field trips.',
  images: {
    vr: '/img/vr image.png',
    astro: '/img/astro.png',
  },
};

export const partnerLogos = [
  { src: '/img/client-1.png', alt: 'Partner' },
  { src: '/img/client-2.png', alt: 'Partner' },
  { src: '/img/client-3.png', alt: 'Partner' },
  { src: '/img/client-4.png', alt: 'Partner' },
  { src: '/img/sptbilogo.png', alt: 'SPTBI' },
];

export const whoWeAre = {
  eyebrow: 'Who we are',
  lines: [
    'LearnXR by Altie Reality is proudly funded by Meta Inc through Meta XR Startup program',
    'In association with iStart & SPTBI',
  ],
  image: '/img/vr image3.jpg',
};

export const whyCards = [
  {
    title: 'Meta-backed XR',
    description:
      'Proudly funded by Meta Inc through the Meta XR Startup program — building the next generation of immersive education.',
  },
  {
    title: 'AI + XR together',
    description:
      'Combine intelligent tutoring with virtual classrooms so every learner can explore concepts in three dimensions.',
  },
  {
    title: 'K-12 ready',
    description:
      'Curriculum coverage through K-12 — STEM, humanities, immersive lessons, and virtual field trips in one platform.',
  },
  {
    title: 'Built with partners',
    description:
      'In association with iStart & SPTBI, working alongside schools and institutions across India.',
  },
];

export const howItWorks = [
  {
    step: '01',
    title: 'Explore content',
    description: 'Browse immersive K-12 lessons spanning STEM, humanities, and virtual field trips.',
  },
  {
    step: '02',
    title: 'Enter the XR classroom',
    description: 'Step into virtual worlds on headset or web — interactive environments that make concepts stick.',
  },
  {
    step: '03',
    title: 'Learn with AI guidance',
    description: 'Use AI tutoring and self-paced paths so every student moves at the right speed.',
  },
  {
    step: '04',
    title: 'Assess & grow',
    description: 'Measure understanding with immersive assessments and track progress over time.',
  },
];

export const aiExperiences = [
  {
    id: 'tutor',
    title: 'AI Tutor',
    description: 'Guided explanations and support that adapt as students explore immersive lessons.',
  },
  {
    id: 'classroom',
    title: 'Virtual Classrooms',
    description: 'Shared XR spaces where teachers and learners meet inside the subject itself.',
  },
  {
    id: 'selfpaced',
    title: 'Self-paced learning',
    description: 'Students revisit worlds and concepts until mastery — without leaving the experience.',
  },
  {
    id: 'immersive',
    title: 'Immersive Experiences',
    description: 'From Curiosity Rover tours to historical sites — learning by being there.',
  },
  {
    id: 'assessments',
    title: 'Assessments',
    description: 'Scenario-based checks that measure applied understanding inside XR contexts.',
  },
];

export const contentSlides = [
  {
    image: '/img/lxrn4.png',
    title: 'STEM Lesson',
    description:
      'Virtual reality transforms STEM learning by providing interactive experiences that enhance understanding of complex concepts in science, technology, engineering, and mathematics.',
  },
  {
    image: '/img/lxrn3.png',
    title: 'Humanities',
    description: 'VR revolutionizes humanities education with immersive, interactive experiences.',
  },
  {
    image: '/img/lxrn2.png',
    title: 'Immersive Learning',
    description: 'VR enables immersive learning through interactive, virtual experiences.',
  },
  {
    image: '/img/lxrn5.png',
    title: 'Field Trip',
    description:
      'A virtual reality field trip offers immersive educational experiences, allowing students to explore diverse environments and historical sites without leaving the classroom.',
  },
];

export const impactProof = [
  {
    label: 'Meta XR Startup',
    detail: 'Proudly funded by Meta Inc through the Meta XR Startup program',
  },
  {
    label: 'K-12 coverage',
    detail: 'Content covered up to K-12 across STEM, humanities, and field trips',
  },
  {
    label: 'Association partners',
    detail: 'In association with iStart & SPTBI',
  },
  {
    label: 'Educator trusted',
    detail: 'Principals, parents, and students recommend LearnXR for immersive retention',
  },
];

export const faqs = [
  {
    question: 'Is LearnXR backed by Meta?',
    answer:
      'Yes. LearnXR by Altie Reality is funded through the Meta XR Startup program and built for classroom-ready immersive learning.',
  },
  {
    question: 'What is the difference between School and Individual plans?',
    answer:
      'Schools get LearnXR Labs with multi-user management, teacher tools, and curriculum rollout. Individuals use the LearnXR app for personal immersive lessons and field trips.',
  },
  {
    question: 'Do we need VR headsets to get started?',
    answer:
      'No. Lessons run in the browser for quick adoption, and the same content extends to Meta Quest and SideQuest when you are ready for full immersion.',
  },
  {
    question: 'Which subjects and grades does LearnXR cover?',
    answer:
      'Content covers K-12 across STEM, humanities, and virtual field trips — designed to map onto existing classroom curricula.',
  },
  {
    question: 'How does a demo work?',
    answer:
      'Book a demo from any page. Our team walks you through a live lesson, lab setup options, and a rollout plan tailored to your school or partner program.',
  },
  {
    question: 'How is student data handled?',
    answer:
      'We use industry-standard encryption and access controls. Review our Privacy Policy for details on collection, retention, and your rights.',
  },
];

export const featureBento = [
  {
    title: 'STEM worlds',
    description: contentSlides[0].description,
    image: contentSlides[0].image,
    span: 'lg:col-span-2',
  },
  {
    title: 'Humanities',
    description: contentSlides[1].description,
    image: contentSlides[1].image,
    span: '',
  },
  {
    title: 'Immersive learning',
    description: contentSlides[2].description,
    image: contentSlides[2].image,
    span: '',
  },
  {
    title: 'Virtual field trips',
    description: contentSlides[3].description,
    image: contentSlides[3].image,
    span: 'lg:col-span-2',
  },
];

export const xrClassroom = {
  eyebrow: 'XR Classroom',
  title: 'Step inside the lesson',
  description:
    'Large-scale immersive environments turn abstract topics into places students can walk through, touch, and remember.',
  imagePrimary: '/img/vr image3.jpg',
  imageSecondary: '/img/vr-img3.png',
};

export const companyActivity = {
  eyebrow: 'Company activity',
  title: 'Latest from Altie Reality',
  image: '/img/vr-img3.png',
};

export const cta = {
  title: 'Bring XR learning to your school',
  description: 'Explore case studies, join the partner program, book a demo, or download the LearnXR app on Meta.',
};

export const footer = {
  blurb: 'AI-powered XR learning for schools and learners — from K-12 STEM to immersive field trips.',
  phones: ['+91 8619953434', '+91 9145822691'],
  addressLines: ['41,42 Bhamashah Technohub', 'Santhan Path, Malviya Nagar , Jaipur 302007'],
  email: 'admin@altiereality.com',
  copyright: '© Altie Reality 2020-2025',
  links: [
    { label: 'Case Studies', to: '/case-studies' as const },
    { label: 'Channel Partners', to: '/channel-partners' as const },
    { label: 'Youtube', href: 'https://www.youtube.com/channel/UCXhsQN9jsazg4FDoIuSseBg' as const },
    { label: 'Facebook', href: 'https://www.facebook.com/altiereality' as const },
    { label: 'Instagram', href: 'https://www.instagram.com/learn__xr/' as const },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/company/altie-reality/mycompany/' as const },
  ],
};
