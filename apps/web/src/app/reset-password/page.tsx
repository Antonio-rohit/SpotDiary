'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Lock, KeyRound, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Missing reset token. Please use the link provided in your email.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok && data.success) {
        setSuccess(true);
      } else {
        setError(data.error || 'Failed to reset password. Token may be invalid or expired.');
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'An unexpected error occurred.');
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 bg-white rounded-3xl p-6 md:p-8 shadow-card border border-[#E8E7DF]">
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-[#254542] text-white flex items-center justify-center font-bold text-2xl mx-auto mb-3 shadow-md">
          <KeyRound className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold text-[#273C3A]">Reset Your Password</h1>
        <p className="text-xs text-[#89928D] mt-1">
          Choose a new password for your SpotDiary account.
        </p>
      </div>

      {!token ? (
        <div className="bg-rose-50 text-rose-700 border border-rose-200 p-4 rounded-2xl text-xs space-y-3">
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Missing Reset Token</span>
          </div>
          <p>No valid reset token was found in the URL. Please request a new password reset link.</p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-[#254542] text-white rounded-xl font-bold text-xs hover:bg-[#1C3533] transition-smooth mt-2"
          >
            Return to Home
          </Link>
        </div>
      ) : success ? (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-6 rounded-2xl text-center space-y-4">
          <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
          <h2 className="text-lg font-bold text-emerald-900">Password Reset Complete!</h2>
          <p className="text-xs text-emerald-700">
            Your password has been successfully updated. You can now log in using your new credentials.
          </p>
          <Link
            href="/"
            className="inline-block w-full py-3 bg-[#254542] text-white rounded-2xl font-bold text-xs hover:bg-[#1C3533] shadow-md transition-smooth"
          >
            Go to Home & Sign In
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-rose-50 text-rose-600 border border-rose-200 p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#273C3A] mb-1 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-[#254542]" />
              New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl px-4 py-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#273C3A] mb-1 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-[#254542]" />
              Confirm New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl px-4 py-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl text-xs font-bold text-white bg-[#254542] hover:bg-[#1C3533] shadow-md transition-smooth disabled:opacity-50 mt-2"
          >
            {loading ? 'Resetting Password...' : 'Reset Password'}
          </button>

          <div className="text-center pt-2">
            <Link
              href="/"
              className="text-xs font-bold text-[#89928D] hover:text-[#254542] inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#F8F5EE]">
      <Navbar />
      <Suspense fallback={<div className="text-center py-12 text-xs text-[#89928D]">Loading password reset...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
