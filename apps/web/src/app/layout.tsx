import type { Metadata } from 'next';
import './globals.css';
import MobileBottomNav from '@/components/MobileBottomNav';
import { AuthProvider } from '@/lib/auth/AuthContext';

export const metadata: Metadata = {
  title: 'SpotDiary — Discover Places. Save Memories. Share Experiences in Pune',
  description: 'SpotDiary is a place discovery and personal experience diary for cafes, restaurants, date spots, and hidden gems in Pune, Maharashtra, India.',
  keywords: ['SpotDiary', 'Pune Cafes', 'Baner Cafes', 'Koregaon Park', 'Date Night Pune', 'Food Diary', 'Travel Diary'],
  authors: [{ name: 'SpotDiary Team' }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-[#F8F5EE] text-[#273C3A] antialiased">
        <AuthProvider>
          <main className="flex-1 pb-24 md:pb-12">
            {children}
          </main>
          
          {/* Floating Mobile Navigation Bar */}
          <MobileBottomNav />

          {/* Global Footer */}
          <footer className="hidden md:block bg-white border-t border-[#E8E7DF] py-8 px-6 text-center text-xs text-[#89928D]">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 font-bold text-[#273C3A]">
                <span className="w-6 h-6 rounded-lg bg-[#254542] text-white flex items-center justify-center text-xs">S</span>
                <span>SpotDiary Pune</span>
              </div>
              <div className="flex items-center gap-6">
                <a href="#" className="hover:text-[#254542]">Privacy Policy</a>
                <a href="#" className="hover:text-[#254542]">Terms of Service</a>
                <a href="#" className="hover:text-[#254542]">Pune Localities Guide</a>
                <a href="#" className="hover:text-[#254542]">API & Providers</a>
              </div>
              <div>
                © 2026 SpotDiary Inc. Built for Pune, Maharashtra.
              </div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
