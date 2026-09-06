/**
 * SchoolPerformance – how any school is doing, for admins and super admins.
 *
 * Teachers had these panels, principals and school admins now have them, and
 * this is the same set again for someone who oversees more than one school. The
 * aggregation and the markup are shared (`lib/dashboard/performance`,
 * `Components/dashboard/PerformanceSections`), so an admin questioning a
 * principal's figures is looking at the identical arithmetic rather than a
 * fourth reimplementation of it.
 *
 * One school at a time, chosen from a picker: a single average across schools of
 * very different sizes says almost nothing, and the question an admin actually
 * has is about a particular school.
 */

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore';

import { db } from '../../config/firebase';
import { Card, CardContent } from '../../Components/ui/card';
import { PerformanceSections } from '../../Components/dashboard/PerformanceSections';
import type { LessonLaunch, StudentScore } from '../../types/lms';

interface SchoolOption {
  id: string;
  name: string;
}

const SchoolPerformance = () => {
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [schoolId, setSchoolId] = useState<string>('');
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [scores, setScores] = useState<StudentScore[]>([]);
  const [launches, setLaunches] = useState<LessonLaunch[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // The list of schools to choose from. Read once — schools are not created
  // often enough to justify a live subscription on this screen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'schools'));
        if (cancelled) return;
        const list = snap.docs
          .map((d) => ({ id: d.id, name: String((d.data() as any)?.name || d.id) }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setSchools(list);
        setSchoolId((current) => current || list[0]?.id || '');
      } catch (err: any) {
        setDataError(`Schools could not be listed: ${err?.message || err}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    setDataError(null);

    /** Every subscription reports its own failure; none may fail silently. */
    const watch = (q: any, apply: (rows: any[]) => void, label: string) =>
      onSnapshot(
        q,
        (snapshot: any) => {
          apply(snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        (error: any) => {
          console.error(`SchoolPerformance: ${label} query failed`, error);
          setDataError(`${label} could not be read: ${error.message}`);
          setLoading(false);
        }
      );

    const offs = [
      watch(
        query(collection(db, 'classes'), where('school_id', '==', schoolId)),
        setClasses,
        'Classes'
      ),
      watch(
        query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('school_id', '==', schoolId)
        ),
        (rows) => setStudents(rows.map((r) => ({ ...r, uid: r.id }))),
        'Students'
      ),
      watch(
        query(
          collection(db, 'student_scores'),
          where('school_id', '==', schoolId),
          orderBy('completed_at', 'desc')
        ),
        (rows) => setScores(rows as StudentScore[]),
        'Student scores'
      ),
      watch(
        query(
          collection(db, 'lesson_launches'),
          where('school_id', '==', schoolId),
          orderBy('launched_at', 'desc')
        ),
        (rows) => setLaunches(rows as LessonLaunch[]),
        'Lesson launches'
      ),
    ];

    return () => offs.forEach((off) => off());
  }, [schoolId]);

  const selected = useMemo(
    () => schools.find((s) => s.id === schoolId),
    [schools, schoolId]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">School performance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The same figures the school's own staff see, from the same source.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">School</span>
          <select
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            className="h-10 min-w-[14rem] rounded-lg border border-border bg-background px-3 text-foreground"
          >
            {schools.length === 0 && <option value="">No schools found</option>}
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!schoolId ? (
        <Card className="border-border bg-card">
          <CardContent className="p-8 text-center text-muted-foreground">
            Choose a school to see its performance.
          </CardContent>
        </Card>
      ) : (
        <PerformanceSections
          classes={classes}
          students={students}
          scores={scores}
          launches={launches}
          loadError={dataError}
          loading={loading}
          scopeLabel={selected?.name || 'this school'}
        />
      )}
    </div>
  );
};

export default SchoolPerformance;
