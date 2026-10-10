'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Compass, Bookmark, BookOpen, User, Plus, Search, MapPin, LogOut } from 'lucide-react';
import AuthModal from './AuthModal';
import ManualPlaceModal from './ManualPlaceModal';
import { useAuth } from '@/lib/auth/AuthContext';

interface NavbarProps {
  onOpenAddVisit?: () => void;
}

export default function Navbar({ onOpenAddVisit }: NavbarProps) {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAddPlaceOpen, setIsAddPlaceOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    setIsMenuOpen(false);
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#F8F5EE]/90 backdrop-blur-md border-b border-[#E8E7DF] px-4 lg:px-8 py-3.5 transition-smooth">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo & City Location Selector */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-2xl bg-[#254542] text-white flex items-center justify-center font-bold text-xl shadow-md group-hover:scale-105 transition-smooth">
                S
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-[#273C3A] block leading-none">
                  Spot<span className="text-[#254542]">Diary</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#89928D] block mt-0.5">
                  Pune, MH
                </span>
              </div>
            </Link>

            {/* City Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E8E7DF] text-xs font-semibold text-[#254542]">
              <MapPin className="w-3.5 h-3.5 text-[#254542]" />
              <span>Pune, Maharashtra</span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-white border border-[#E8E7DF] rounded-full p-1 shadow-sm">
            <Link 
              href="/" 
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#254542] bg-[#F8F5EE] transition-smooth"
            >
              <Compass className="w-4 h-4" />
              <span>Discover</span>
            </Link>
            <Link 
              href="/explore" 
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#89928D] hover:text-[#273C3A] hover:bg-[#F8F5EE] transition-smooth"
            >
              <Search className="w-4 h-4" />
              <span>Explore</span>
            </Link>
            <Link 
              href="/my-places" 
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#89928D] hover:text-[#273C3A] hover:bg-[#F8F5EE] transition-smooth"
            >
              <Bookmark className="w-4 h-4" />
              <span>My Places</span>
            </Link>
            <Link 
              href="/collections" 
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#89928D] hover:text-[#273C3A] hover:bg-[#F8F5EE] transition-smooth"
            >
              <BookOpen className="w-4 h-4" />
              <span>Collections</span>
            </Link>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5 relative">
            <button
              onClick={() => setIsAddPlaceOpen(true)}
              className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-[#254542] bg-white hover:bg-[#F8F5EE] border border-[#E8E7DF] px-3.5 py-2.5 rounded-full transition-smooth shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Place</span>
            </button>

            {onOpenAddVisit && (
              <button
                onClick={onOpenAddVisit}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#254542] hover:bg-[#1C3533] px-4 py-2.5 rounded-full transition-smooth shadow-md hover:shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span>Log Visit</span>
              </button>
            )}

            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-[#254542] text-white font-bold text-xs shadow-md border-2 border-white hover:scale-105 transition-smooth"
                  title={user.display_name}
                >
                  {getInitials(user.display_name)}
                </button>

                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl border border-[#E8E7DF] shadow-xl py-2 z-50 text-xs">
                    <div className="px-4 py-2 border-b border-[#E8E7DF]">
                      <p className="font-bold text-[#273C3A] truncate">{user.display_name}</p>
                      <p className="text-[10px] text-[#89928D] truncate">@{user.username || user.email.split('@')[0]}</p>
                    </div>

                    <Link
                      href="/profile"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-[#273C3A] hover:bg-[#F8F5EE] font-semibold transition-smooth"
                    >
                      <User className="w-4 h-4 text-[#254542]" />
                      <span>Profile Settings</span>
                    </Link>

                    <Link
                      href="/my-places"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-[#273C3A] hover:bg-[#F8F5EE] font-semibold transition-smooth"
                    >
                      <Bookmark className="w-4 h-4 text-[#254542]" />
                      <span>My Places & Visits</span>
                    </Link>

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-rose-600 hover:bg-rose-50 font-semibold text-left border-t border-[#E8E7DF] transition-smooth"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-white border border-[#E8E7DF] text-[#254542] hover:bg-[#254542] hover:text-white transition-smooth shadow-sm"
                title="Sign In / Profile"
              >
                <User className="w-4 h-4" />
              </button>
            )}
          </div>

        </div>
      </header>

      {/* Modals */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <ManualPlaceModal isOpen={isAddPlaceOpen} onClose={() => setIsAddPlaceOpen(false)} />
    </>
  );
}
