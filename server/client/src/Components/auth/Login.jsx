import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import FuturisticBackground from '../FuturisticBackground';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, loginWithGoogle, user } = useAuth();
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
      await login(email, password);
      // Navigation will happen in useEffect
    } catch (error) {
      setError('Failed to login. ' + error.message);
    }
  };

  return (
    <FuturisticBackground variant="auth">
      <div className="min-h-screen flex items-center justify-center">
        {/* Login Form */}
        <div className="bg-gray-800/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl w-96 border border-gray-700/50">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
            <p className="text-gray-400">Sign in to continue to In3D.ai</p>
          </div>
          
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-300 p-3 rounded-lg mb-4">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="Enter your password"
                required
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white p-3 rounded-lg font-semibold hover:from-cyan-400 hover:to-blue-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-cyan-500/25"
            >
              Sign In
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
          
          <div className="mt-6 text-center space-y-2">
            <p className="text-gray-400 text-sm">
              Don't have an account?{' '}
              <Link to="/signup" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                Sign Up
              </Link>
            </p>
            <p className="text-gray-400 text-sm">
              <Link to="/forgot-password" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                Forgot Password?
              </Link>
            </p>
          </div>
        </div>
      </div>
    </FuturisticBackground>
  );
}; 
