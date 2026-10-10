'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import AddVisitModal from '@/components/AddVisitModal';
import AuthModal from '@/components/AuthModal';
import { User, LogOut, Check, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const { user, isAuthenticated, loading, logout, refreshUser } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAddVisitOpen, setIsAddVisitOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || '');
      setBio(user.bio || '');
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(false);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName, bio }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'Failed to update profile.');
      } else {
        setSavedMsg(true);
        await refreshUser();
        setTimeout(() => setSavedMsg(false), 3000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F5EE]">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center text-xs font-semibold text-[#89928D]">
          Loading profile...
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-[#F8F5EE]">
        <Navbar onOpenAddVisit={() => setIsAddVisitOpen(true)} />
        <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-white border border-[#E8E7DF] flex items-center justify-center mx-auto text-[#254542] shadow-sm">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#273C3A]">Authentication Required</h2>
          <p className="text-xs text-[#89928D]">
            Please sign in or create an account to view and manage your SpotDiary profile.
          </p>
          <button
            onClick={() => setIsAuthOpen(true)}
            className="px-6 py-3 rounded-2xl bg-[#254542] text-white font-bold text-xs shadow-md hover:bg-[#1C3533] transition-smooth"
          >
            Sign In / Register
          </button>
        </div>
        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F5EE]">
      <Navbar onOpenAddVisit={() => setIsAddVisitOpen(true)} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Profile Card Header */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#E8E7DF] shadow-card text-center relative">
          <div className="w-24 h-24 rounded-full bg-[#254542] text-white flex items-center justify-center font-bold text-3xl mx-auto mb-4 border-4 border-[#F8F5EE] shadow-md">
            {getInitials(user.display_name)}
          </div>
          <h1 className="text-2xl font-bold text-[#273C3A]">{user.display_name}</h1>
          <p className="text-xs text-[#89928D] mt-0.5">@{user.username || user.email.split('@')[0]} • {user.email}</p>
          <p className="text-xs text-[#273C3A] mt-2 max-w-md mx-auto">
            {user.bio || 'Cafe explorer & place discoverer in Pune.'}
          </p>

          <div className="flex items-center justify-center gap-6 mt-6 pt-6 border-t border-[#E8E7DF]">
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-smooth"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Edit Profile Settings */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#E8E7DF] shadow-card space-y-6">
          <h2 className="text-lg font-bold text-[#273C3A] flex items-center gap-2">
            <User className="w-5 h-5 text-[#254542]" />
            <span>Profile Settings</span>
          </h2>

          {savedMsg && (
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200 flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Profile updated successfully!</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 text-xs font-semibold border border-rose-200">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#273C3A] mb-1">Display Name</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl px-4 py-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#273C3A] mb-1">Email Address</label>
              <input
                type="email"
                disabled
                value={user.email}
                className="w-full bg-gray-100 border border-[#E8E7DF] rounded-2xl px-4 py-3 text-xs font-medium text-gray-500 cursor-not-allowed"
              />
              <span className="text-[10px] text-[#89928D] mt-1 block">Primary login email address</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#273C3A] mb-1">Bio</label>
              <textarea
                rows={3}
                placeholder="Share a short bio about your favorite spots in Pune..."
                value={bio}
                onChange={e => setBio(e.target.value)}
                className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl p-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 rounded-2xl bg-[#254542] text-white font-bold text-xs shadow-md hover:bg-[#1C3533] transition-smooth disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <AddVisitModal isOpen={isAddVisitOpen} onClose={() => setIsAddVisitOpen(false)} />
    </div>
  );
}
