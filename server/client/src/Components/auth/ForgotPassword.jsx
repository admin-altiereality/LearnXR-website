import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaArrowLeft, FaEnvelope } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import FlowFieldBackground from '../ui/flow-field-background';

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

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      <FlowFieldBackground
        className="absolute inset-0 min-h-screen"
        color="#8b5cf6"
        trailOpacity={0.1}
        particleCount={400}
        speed={0.8}
      />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          <motion.div custom={1} variants={fadeUpVariants} initial="hidden" animate="visible">
            <Card className="w-full max-w-sm mx-auto bg-card/70 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/20 rounded-[calc(var(--radius)+0.125rem)] overflow-hidden">
              <div className="p-6 pb-5 sm:p-8 sm:pb-6">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <FaEnvelope className="text-xl text-primary" />
                  </div>
                  <h1 className="text-xl font-semibold text-foreground">Reset password</h1>
                  <p className="text-sm text-muted-foreground mt-1">Enter your email to receive reset instructions</p>
                </div>

                {error && (
                  <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                {message && (
                  <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
                    {message}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email" className="text-sm">Email address</Label>
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

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Sending...' : 'Send reset link'}
                  </Button>
                </form>
              </div>

              <div className="bg-muted/50 border-t border-white/10 rounded-b-[calc(var(--radius)+0.125rem)] p-3">
                <p className="text-muted-foreground text-center text-sm">
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
    </div>
  );
};

export default ForgotPassword;
