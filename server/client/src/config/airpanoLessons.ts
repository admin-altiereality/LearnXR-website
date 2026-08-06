/**
 * AirPano 360° embed catalog for the 360 Lessons tab.
 * Each `embedId` is the `3D=` query value for https://www.airpano.com/embed.php
 * IDs below were verified against live AirPano embed responses (title match).
 */

export interface AirpanoLesson {
  id: string;
  title: string;
  /** Country / region label shown on cards */
  location?: string;
  description: string;
  /** Value for the AirPano `3D=` embed query param */
  embedId: string;
}

export function buildAirpanoEmbedUrl(embedId: string): string {
  return `https://www.airpano.com/embed.php?3D=${encodeURIComponent(embedId)}`;
}

export function getAirpanoLessonById(id: string): AirpanoLesson | undefined {
  return AIRPANO_LESSONS.find((lesson) => lesson.id === id);
}

/** Starter catalog — extend by adding verified AirPano `3D=` slugs. */
export const AIRPANO_LESSONS: AirpanoLesson[] = [
  {
    id: 'baikal-lake-russia-2018',
    title: 'Baikal Lake, New Impressions',
    location: 'Russia',
    description: 'Winter ice, Olkhon Island, and the deepest freshwater lake on Earth.',
    embedId: 'baikal-lake-russia-2018',
  },
  {
    id: 'niagara-falls',
    title: 'Niagara Falls',
    location: 'USA / Canada',
    description: 'Aerial 360° views of the falls spanning the US–Canada border.',
    embedId: 'niagara-falls',
  },
  {
    id: 'maldives',
    title: 'Underwater Maldives',
    location: 'Maldives',
    description: 'Dive into coral reefs and underwater life around the Maldives.',
    embedId: 'maldives',
  },
  {
    id: 'maldives-02-2026',
    title: 'Tropical Paradise',
    location: 'Maldives',
    description: 'Turquoise lagoons and island shores from above.',
    embedId: 'maldives-02-2026',
  },
  {
    id: 'moscow-kremlin',
    title: 'Moscow Kremlin',
    location: 'Russia',
    description: 'Historic Kremlin towers and Bolotnaya Square in Moscow.',
    embedId: 'moscow-kremlin',
  },
  {
    id: 'kizhi-autumn',
    title: 'Kizhi, Republic of Karelia',
    location: 'Russia',
    description: 'Wooden churches and autumn landscapes on Lake Onega.',
    embedId: 'kizhi-autumn',
  },
  {
    id: 'algeria-sahara-2',
    title: 'Sahara Desert, Part II',
    location: 'Algeria',
    description: 'Vast dunes and desert light across the Algerian Sahara.',
    embedId: 'algeria-sahara-2',
  },
  {
    id: 'chile-patagonia',
    title: 'Torres del Paine, Patagonia',
    location: 'Chile',
    description: 'Iconic peaks and glacial valleys of Torres del Paine.',
    embedId: 'chile-patagonia',
  },
  {
    id: 'chile-rapa-nui',
    title: 'Rapa Nui, Easter Island',
    location: 'Chile',
    description: 'Moai statues and volcanic landscapes of Easter Island.',
    embedId: 'chile-rapa-nui',
  },
  {
    id: 'chile-rainbow-valley',
    title: 'Rainbow Valley',
    location: 'Chile',
    description: 'Colored rock formations of Valle del Arcoíris in Atacama.',
    embedId: 'chile-rainbow-valley',
  },
  {
    id: 'sri-lanka-sigiriya',
    title: 'Sigiriya Rock Fortress',
    location: 'Sri Lanka',
    description: 'The ancient rock citadel rising above the Sri Lankan jungle.',
    embedId: 'sri-lanka-sigiriya',
  },
  {
    id: 'italy-venice',
    title: 'Venice',
    location: 'Italy',
    description: 'Canals, piazzas, and rooftops of Venice from the air.',
    embedId: 'italy-venice',
  },
  {
    id: 'santorini-greece',
    title: 'Santorini, Oia',
    location: 'Greece',
    description: 'Whitewashed cliffs and caldera views over the Aegean.',
    embedId: 'santorini-greece',
  },
  {
    id: 'bagan-myanmar',
    title: 'Bagan',
    location: 'Myanmar',
    description: 'Thousands of ancient temples across the plains of Bagan.',
    embedId: 'bagan-myanmar',
  },
];
