import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuthStore } from '../stores/authStore';
import { auth } from '../services/api';
import toast from 'react-hot-toast';
import { Mail, Lock, User as UserIcon } from 'lucide-react';
import type { Role } from '@shared/types';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = isSignUp
        ? await auth.register(email, name, password)
        : await auth.login(email, password);

      const { token, user } = response.data.data;
      setAuth(token, {
        ...user,
        role: user.role as Role,
        createdAt: new Date().toISOString(),
      });
      toast.success(isSignUp ? 'Account created!' : 'Logged in successfully!');
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage:
          'linear-gradient(135deg, rgba(75,40,109,0.05), rgba(0,166,81,0.05))',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div
          className="bg-white rounded-2xl shadow-lg p-8"
          style={{ border: '1px solid var(--border)' }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl gradient-mark flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">P</span>
              </div>
              <span className="font-bold text-2xl gradient-text">ProductOS</span>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold mb-2">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p style={{ color: 'var(--neutral-500)' }}>
              {isSignUp
                ? 'Sign up to start building better products'
                : 'Sign in to continue to ProductOS'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="label">Full Name</label>
                <div className="relative">
                  <UserIcon
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--neutral-400)' }}
                  />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="input pl-10"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--neutral-400)' }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="input pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--neutral-400)' }}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-10"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full text-white py-3 rounded-lg hover:opacity-90 transition-opacity font-medium mt-6 disabled:opacity-50"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {isLoading
                ? 'Processing…'
                : isSignUp
                ? 'Create Account'
                : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
              className="text-sm hover:underline"
              style={{ color: 'var(--primary)' }}
            >
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        <p
          className="text-xs text-center mt-6"
          style={{ color: 'var(--neutral-500)' }}
        >
          Part of Telus Digital AI Platform Suite
        </p>
      </motion.div>
    </div>
  );
}
