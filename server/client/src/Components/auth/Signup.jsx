import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import FuturisticBackground from '../FuturisticBackground';

export const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const { signup, loginWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/main');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      await signup(email, password, name);
      // Navigation will happen in useEffect
    } catch (error) {
      setError('Failed to create an account. ' + error.message);
    }
  };

  return (
    <FuturisticBackground variant="auth">
      <div className="min-h-screen flex items-center justify-center">
        {/* Signup Form */}
        <div className="bg-gray-800/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl w-96 border border-gray-700/50">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-white mb-2">Join In3D.ai</h2>
            <p className="text-gray-400">Create your account to get started</p>
          </div>
          
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-300 p-3 rounded-lg mb-4">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-300 mb-2 text-sm font-medium">Full Name</label>
              <input
                type="text"
                className="w-full p-3 rounded-lg bg-gray-700/50 border border-gray-600 text-white placeholder-gray-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                required
              />
            </div>
            
            <div>
              <label className="block text-gray-300 mb-2 text-sm font-medium">Email</label>
              <input
                type="email"
                className="w-full p-3 rounded-lg bg-gray-700/50 border border-gray-600 text-white placeholder-gray-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
            
            <div>
              <label className="block text-gray-300 mb-2 text-sm font-medium">Password</label>
              <input
                type="password"
                className="w-full p-3 rounded-lg bg-gray-700/50 border border-gray-600 text-white placeholder-gray-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password (min 6 characters)"
                required
                minLength="6"
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white p-3 rounded-lg font-semibold hover:from-cyan-400 hover:to-blue-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-cyan-500/25"
            >
              Create Account
            </button>
          </form>
          
          <div className="mt-6">
            <button
              onClick={loginWithGoogle}
              className="w-full bg-white/10 border border-gray-600 text-white p-3 rounded-lg font-semibold hover:bg-white/20 transition-all duration-300"
            >
              Continue with Google
            </button>
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </FuturisticBackground>
  );
}; 