import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import FuturisticBackground from '../FuturisticBackground';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setMessage('');
      setError('');
      setLoading(true);
      await resetPassword(email);
      setMessage('Check your inbox for further instructions');
    } catch (error) {
      setError('Failed to reset password. ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FuturisticBackground variant="auth">
      <div className="min-h-screen flex items-center justify-center">
        {/* Forgot Password Form */}
        <div className="bg-gray-800/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl w-96 border border-gray-700/50">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-white mb-2">Reset Password</h2>
            <p className="text-gray-400">Enter your email to receive reset instructions</p>
          </div>
          
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-300 p-3 rounded-lg mb-4">
              {error}
            </div>
          )}
          
          {message && (
            <div className="bg-green-500/20 border border-green-500/50 text-green-300 p-3 rounded-lg mb-4">
              {message}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-300 mb-2 text-sm font-medium">Email Address</label>
              <input
                type="email"
                className="w-full p-3 rounded-lg bg-gray-700/50 border border-gray-600 text-white placeholder-gray-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white p-3 rounded-lg font-semibold hover:from-cyan-400 hover:to-blue-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? 'Processing...' : 'Send Reset Link'}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
              ← Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </FuturisticBackground>
  );
};

export default ForgotPassword;
