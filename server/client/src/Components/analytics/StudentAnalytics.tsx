/**
 * Student Analytics Component
 * 
 * Displays individual student performance analytics.
 * Access: Student (own), Teacher (their students), Principal (their school)
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getStudentAnalytics, type StudentAnalytics as StudentAnalyticsType } from '../../services/analyticsService';
import { FaChartLine, FaTrophy, FaExclamationTriangle, FaBook, FaCheckCircle } from 'react-icons/fa';

interface StudentAnalyticsProps {
  studentId: string;
}

const StudentAnalytics = ({ studentId }: StudentAnalyticsProps) => {
  const { profile } = useAuth();
  const [analytics, setAnalytics] = useState<StudentAnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    const fetchAnalytics = async () => {
      setLoading(true);
      const data = await getStudentAnalytics(profile, studentId);
      setAnalytics(data);
      setLoading(false);
    };

    fetchAnalytics();
  }, [profile, studentId]);

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
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-3">
            <FaBook className="text-emerald-400" />
            <div>
              <p className="text-white/50 text-sm">Total Lessons</p>
              <p className="text-2xl font-bold text-white">{analytics.totalLessons}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex items-center gap-3">
            <FaCheckCircle className="text-blue-400" />
            <div>
              <p className="text-white/50 text-sm">Completed</p>
              <p className="text-2xl font-bold text-white">{analytics.completedLessons}</p>
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

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-3">
            <FaTrophy className="text-amber-400" />
            <div>
              <p className="text-white/50 text-sm">Best Score</p>
              <p className="text-2xl font-bold text-white">{analytics.bestScore}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Summary */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Performance Summary</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-white/70">Completion Rate</span>
            <span className="text-white font-medium">{analytics.completionRate}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/70">Total Quiz Attempts</span>
            <span className="text-white font-medium">{analytics.totalAttempts}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/70">Average Score</span>
            <span className="text-white font-medium">{analytics.averageScore}%</span>
          </div>
          {analytics.worstScore < 50 && (
            <div className="flex items-center gap-2 text-amber-400">
              <FaExclamationTriangle />
              <span className="text-sm">Lowest score: {analytics.worstScore}% - Consider additional support</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentAnalytics;
