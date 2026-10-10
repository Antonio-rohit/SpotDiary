'use client';

import React, { useState } from 'react';
import { X, Mail, Lock, User, ArrowLeft, KeyRound } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const { login, register } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (mode === 'forgot') {
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        setLoading(false);

        if (res.ok && data.success) {
          setMessage({
            type: 'success',
            text: data.message || 'If an account exists with that email address, a password reset link has been sent.',
          });
        } else {
          setMessage({
            type: 'error',
            text: data.error || 'Failed to process password reset request.',
          });
        }
      } catch (err: any) {
        setLoading(false);
        setMessage({ type: 'error', text: err.message || 'Connection failed.' });
      }
      return;
    }

    let res: { success: boolean; error?: string };

    if (mode === 'signup') {
      res = await register(email, password, displayName);
    } else {
      res = await login(email, password);
    }

    setLoading(false);

    if (res.success) {
      setEmail('');
      setPassword('');
      setDisplayName('');
      setMessage(null);
      onClose();
    } else {
      setMessage({ type: 'error', text: res.error || 'Authentication failed.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl border border-[#E8E7DF] relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#F8F5EE] text-[#273C3A] flex items-center justify-center hover:bg-[#254542] hover:text-white transition-smooth"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#254542] text-white flex items-center justify-center font-bold text-2xl mx-auto mb-3 shadow-md">
            S
          </div>
          <h2 className="text-2xl font-bold text-[#273C3A]">
            {mode === 'signin' && 'Welcome Back'}
            {mode === 'signup' && 'Create SpotDiary Account'}
            {mode === 'forgot' && 'Reset Password'}
          </h2>
          <p className="text-xs text-[#89928D] mt-1">
            {mode === 'signin' && 'Sign in to access your personal visit memories and saved places.'}
            {mode === 'signup' && 'Join the Pune place discovery & digital memory community.'}
            {mode === 'forgot' && 'Enter your email address and we will send you a password reset link.'}
          </p>
        </div>

        {message && (
          <div
            className={`mb-4 p-3 rounded-2xl text-xs font-semibold border ${
              message.type === 'error'
                ? 'bg-rose-50 text-rose-600 border-rose-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-[#273C3A] mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-[#254542]" />
                Display Name
              </label>
              <input
                type="text"
                required
                placeholder="Rohit Sharma"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl px-4 py-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#273C3A] mb-1 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-[#254542]" />
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl px-4 py-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-[#273C3A] flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-[#254542]" />
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setMessage(null);
                    }}
                    className="text-[11px] font-bold text-[#254542] hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl px-4 py-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl text-xs font-bold text-white bg-[#254542] hover:bg-[#1C3533] shadow-md transition-smooth disabled:opacity-50 mt-2"
          >
            {loading
              ? 'Processing...'
              : mode === 'signin'
              ? 'Sign In'
              : mode === 'signup'
              ? 'Create Account'
              : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-[#E8E7DF] pt-4">
          {mode === 'forgot' ? (
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setMessage(null);
              }}
              className="text-xs font-bold text-[#254542] hover:underline flex items-center justify-center gap-1 mx-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setMessage(null);
              }}
              className="text-xs font-bold text-[#254542] hover:underline"
            >
              {mode === 'signin'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
