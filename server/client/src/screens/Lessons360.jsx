/**
 * 360 Lessons — browse AirPano 360° embeds in a searchable card grid.
 * Only one iframe is mounted at a time (viewer state), per AirPano guidance.
 */

import { ArrowLeft, Globe2, MapPin, Search, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Button } from '../Components/ui/button';
import { Card, CardContent } from '../Components/ui/card';
import { Input } from '../Components/ui/input';
import {
  AIRPANO_LESSONS,
  buildAirpanoEmbedUrl,
} from '../config/airpanoLessons';

const Lessons360 = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const filteredLessons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return AIRPANO_LESSONS;
    return AIRPANO_LESSONS.filter((lesson) => {
      const haystack = [
        lesson.title,
        lesson.location,
        lesson.description,
        lesson.id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [searchQuery]);

  const selectedLesson = useMemo(
    () => AIRPANO_LESSONS.find((l) => l.id === selectedId) || null,
    [selectedId]
  );

  if (selectedLesson) {
    const embedUrl = buildAirpanoEmbedUrl(selectedLesson.embedId);
    return (
      <div className="min-h-screen bg-background pt-24 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6 border-b border-border pb-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-xl border border-border"
                  onClick={() => setSelectedId(null)}
                  aria-label="Back to 360 lessons"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="min-w-0">
                  <h1 className="text-xl font-bold text-foreground truncate">
                    {selectedLesson.title}
                  </h1>
                  {selectedLesson.location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {selectedLesson.location}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                    {selectedLesson.description}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 self-start"
                onClick={() => setSelectedId(null)}
              >
                <X className="w-4 h-4 mr-1.5" />
                Close viewer
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <iframe
              title={selectedLesson.title}
              src={embedUrl}
              className="w-full border-0 block"
              style={{ minHeight: 450, height: '65vh' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          <p className="mt-4 text-sm text-muted-foreground text-center">
            Courtesy of{' '}
            <a
              href="https://www.airpano.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-medium hover:underline"
            >
              www.AirPano.ru
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-border flex items-center justify-center">
              <Globe2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">360 Lessons</h1>
              <p className="text-xs text-muted-foreground">
                Explore the world with AirPano 360° aerial panoramas
              </p>
            </div>
          </div>
        </div>

        <Card className="mb-6 rounded-xl border-border">
          <CardContent className="p-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by place, region, or title..."
                className="pl-9 bg-background border-border text-foreground placeholder:text-muted-foreground"
                aria-label="Search 360 lessons"
              />
            </div>
          </CardContent>
        </Card>

        {filteredLessons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Globe2 className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-foreground font-medium">No matching panoramas</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try a different search term
            </p>
            {searchQuery && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setSearchQuery('')}
              >
                Clear search
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredLessons.map((lesson) => (
              <div
                key={lesson.id}
                role="button"
                tabIndex={0}
                className="h-full flex flex-col bg-card rounded-2xl border border-border overflow-hidden
                           cursor-pointer transition-all duration-300 group
                           hover:shadow-lg hover:border-primary/50 hover:shadow-primary/10"
                onClick={() => setSelectedId(lesson.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedId(lesson.id);
                  }
                }}
              >
                <div className="relative aspect-video w-full flex-shrink-0 overflow-hidden bg-muted">
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/10 via-muted to-primary/5 transition-transform duration-500 group-hover:scale-105">
                    <Globe2 className="w-10 h-10 text-primary/70" />
                    {lesson.location && (
                      <span className="text-xs font-medium text-muted-foreground px-2 text-center">
                        {lesson.location}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col flex-1 p-4 gap-2">
                  <h3 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                    {lesson.title}
                  </h3>
                  {lesson.location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {lesson.location}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-auto">
                    {lesson.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Lessons360;
