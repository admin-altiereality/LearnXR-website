import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaArrowLeft, FaEnvelope } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import FuturisticBackground from '../FuturisticBackground';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();
  const { setTheme } = useTheme();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setMessage('');
      setError('');
      setLoading(true);
      await resetPassword(email);
      setMessage('Check your inbox for further instructions');
    } catch (err) {
      setError('Failed to reset password. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, delay: 0.2 + i * 0.1, ease: [0.25, 0.4, 0.25, 1] },
    }),
  };

  // Forgot password: dark mode only, no toggle
  useEffect(() => {
    setTheme('dark');
  }, [setTheme]);

  return (
    <FuturisticBackground className="h-[100dvh] max-h-[100dvh] w-screen overflow-hidden flex flex-col">
      <div className="relative z-10 flex flex-1 min-h-0 flex-col items-center justify-center px-3 py-3 overflow-hidden">
        <div className="w-full max-w-md flex flex-col gap-2 max-h-[96dvh] overflow-hidden">
          <motion.div custom={1} variants={fadeUpVariants} initial="hidden" animate="visible" className="shrink-0">
            <Card className="w-full max-w-sm mx-auto bg-card/80 backdrop-blur-xl border border-border shadow-xl rounded-2xl overflow-hidden shrink-0">
              <div className="p-3 sm:p-4 pb-3">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2">
                    <FaEnvelope className="text-lg text-primary" />
                  </div>
                  <h1 className="text-lg font-semibold text-foreground">Reset password</h1>
                  <p className="text-xs text-muted-foreground mt-0.5">Enter your email to receive reset instructions</p>
                </div>

                {error && (
                  <div className="mt-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {error}
                  </div>
                )}

                {message && (
                  <div className="mt-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
                    {message}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="mt-3 space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email" className="text-xs">Email address</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      disabled={loading}
                      className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/20"
                    />
                  </div>

                  <Button type="submit" className="w-full h-9 text-sm" disabled={loading}>
                    {loading ? 'Sending...' : 'Send reset link'}
                  </Button>
                </form>
              </div>

              <div className="bg-muted/30 border-t border-border rounded-b-2xl p-2 shrink-0">
                <p className="text-muted-foreground text-center text-xs">
                  Remember your password?{' '}
                  <Button variant="link" className="px-1 h-auto text-primary font-medium" asChild>
                    <Link to="/login">Sign In</Link>
                  </Button>
                </p>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </FuturisticBackground>
  );
};

export default ForgotPassword;
