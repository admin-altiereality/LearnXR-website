/**
 * Class Analytics Component
 * 
 * Displays class-wide performance analytics (teacher view).
 * Access: Teacher (their classes), Principal (their school)
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getClassAnalytics, type ClassAnalytics as ClassAnalyticsType } from '../../services/analyticsService';
import { FaUsers, FaChartLine, FaTrophy, FaExclamationTriangle } from 'react-icons/fa';

interface ClassAnalyticsProps {
  classId: string;
}

const ClassAnalytics = ({ classId }: ClassAnalyticsProps) => {
  const { profile } = useAuth();
  const [analytics, setAnalytics] = useState<ClassAnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    const fetchAnalytics = async () => {
      setLoading(true);
      const data = await getClassAnalytics(profile, classId);
      setAnalytics(data);
      setLoading(false);
    };

    fetchAnalytics();
  }, [profile, classId]);

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
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex items-center gap-3">
            <FaUsers className="text-blue-400" />
            <div>
              <p className="text-white/50 text-sm">Students</p>
              <p className="text-2xl font-bold text-white">{analytics.totalStudents}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
          <div className="flex items-center gap-3">
            <FaChartLine className="text-purple-400" />
            <div>
              <p className="text-white/50 text-sm">Avg Score</p>
              <p className="text-2xl font-bold text-white">{analytics.averageScore}%</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-3">
            <FaTrophy className="text-emerald-400" />
            <div>
              <p className="text-white/50 text-sm">Completion</p>
              <p className="text-2xl font-bold text-white">{analytics.completionRate}%</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-3">
            <FaChartLine className="text-amber-400" />
            <div>
              <p className="text-white/50 text-sm">Attempts</p>
              <p className="text-2xl font-bold text-white">{analytics.totalAttempts}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Performers */}
      {analytics.topPerformers.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FaTrophy className="text-amber-400" />
            Top Performers
          </h3>
          <div className="space-y-2">
            {analytics.topPerformers.map((performer, index) => (
              <div key={performer.studentId} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <span className="text-white/70">#{index + 1} Student {performer.studentId.slice(0, 8)}</span>
                <span className="text-emerald-400 font-medium">{performer.averageScore}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Struggling Students */}
      {analytics.strugglingStudents.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FaExclamationTriangle className="text-amber-400" />
            Students Needing Support
          </h3>
          <div className="space-y-2">
            {analytics.strugglingStudents.map((student) => (
              <div key={student.studentId} className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10">
                <span className="text-white/70">Student {student.studentId.slice(0, 8)}</span>
                <span className="text-amber-400 font-medium">{student.averageScore}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassAnalytics;
