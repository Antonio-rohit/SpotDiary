'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Heart, BookMarked, User } from 'lucide-react';

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <div className="md:hidden fixed bottom-4 left-4 right-4 z-50">
      <nav className="bg-[#254542] text-white rounded-full py-3 px-6 shadow-xl flex items-center justify-around border border-[#1C3533]/40 backdrop-blur-md">
        <Link 
          href="/" 
          className={`flex flex-col items-center gap-1 text-xs transition-smooth ${
            pathname === '/' ? 'text-white font-bold scale-110' : 'text-white/60 hover:text-white'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px]">Discover</span>
        </Link>

        <Link 
          href="/explore" 
          className={`flex flex-col items-center gap-1 text-xs transition-smooth ${
            pathname === '/explore' ? 'text-white font-bold scale-110' : 'text-white/60 hover:text-white'
          }`}
        >
          <Heart className="w-5 h-5" />
          <span className="text-[10px]">Explore</span>
        </Link>

        <Link 
          href="/my-places" 
          className={`flex flex-col items-center gap-1 text-xs transition-smooth ${
            pathname === '/my-places' ? 'text-white font-bold scale-110' : 'text-white/60 hover:text-white'
          }`}
        >
          <BookMarked className="w-5 h-5" />
          <span className="text-[10px]">My Visits</span>
        </Link>

        <Link 
          href="/profile" 
          className={`flex flex-col items-center gap-1 text-xs transition-smooth ${
            pathname === '/profile' ? 'text-white font-bold scale-110' : 'text-white/60 hover:text-white'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px]">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
