/**
 * School Analytics Component
 * 
 * Displays school-wide metrics (principal view).
 * Access: Principal (their school), Admin/Superadmin (all)
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getSchoolAnalytics, type SchoolAnalytics as SchoolAnalyticsType } from '../../services/analyticsService';
import { FaSchool, FaUsers, FaChalkboardTeacher, FaChartLine, FaGraduationCap } from 'react-icons/fa';

interface SchoolAnalyticsProps {
  schoolId: string;
}

const SchoolAnalytics = ({ schoolId }: SchoolAnalyticsProps) => {
  const { profile } = useAuth();
  const [analytics, setAnalytics] = useState<SchoolAnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    const fetchAnalytics = async () => {
      setLoading(true);
      const data = await getSchoolAnalytics(profile, schoolId);
      setAnalytics(data);
      setLoading(false);
    };

    fetchAnalytics();
  }, [profile, schoolId]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mx-auto"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-8 text-white/50">
        No analytics data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
          <div className="flex items-center gap-3">
            <FaChalkboardTeacher className="text-purple-400" />
            <div>
              <p className="text-white/50 text-sm">Teachers</p>
              <p className="text-2xl font-bold text-white">{analytics.totalTeachers}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex items-center gap-3">
            <FaUsers className="text-blue-400" />
            <div>
              <p className="text-white/50 text-sm">Students</p>
              <p className="text-2xl font-bold text-white">{analytics.totalStudents}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-3">
            <FaChartLine className="text-emerald-400" />
            <div>
              <p className="text-white/50 text-sm">Avg Score</p>
              <p className="text-2xl font-bold text-white">{analytics.averageScore}%</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-3">
            <FaGraduationCap className="text-amber-400" />
            <div>
              <p className="text-white/50 text-sm">Engagement</p>
              <p className="text-2xl font-bold text-white">{analytics.lessonEngagement}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* School Summary */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <h3 className="text-lg font-semibold text-white mb-4">School Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white/70">Total Classes</span>
              <span className="text-white font-medium">{analytics.totalClasses}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/70">Total Quiz Attempts</span>
              <span className="text-white font-medium">{analytics.totalAttempts}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/70">Average Score</span>
              <span className="text-white font-medium">{analytics.averageScore}%</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white/70">Completion Rate</span>
              <span className="text-white font-medium">{analytics.completionRate}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/70">Lesson Engagement</span>
              <span className="text-white font-medium">{analytics.lessonEngagement}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Teacher Activity */}
      {analytics.teacherActivity.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FaChalkboardTeacher className="text-purple-400" />
            Teacher Activity
          </h3>
          <div className="space-y-2">
            {analytics.teacherActivity.map((teacher) => (
              <div key={teacher.teacherId} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <span className="text-white/70">Teacher {teacher.teacherId.slice(0, 8)}</span>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-white/50">{teacher.classesCount} classes</span>
                  <span className="text-white/50">{teacher.studentsCount} students</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolAnalytics;
