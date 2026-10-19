import React from 'react';
import { ShieldCheck, UserCheck, ExternalLink } from 'lucide-react';
import { sounds } from '../utils/audio';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate }) => {
  const isAdmin = currentPath === '/admin';

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-ink/90 backdrop-blur-md px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo matching nvbarbers.eu */}
        <div
          onClick={() => {
            sounds.playClick();
            onNavigate('/');
          }}
          className="group flex items-center gap-2.5 cursor-pointer"
        >
          <img
            src="/logo-nv.png"
            alt="NV Barbers"
            className="h-8 sm:h-9 w-auto object-contain transition-transform group-hover:scale-105"
            onError={(e) => {
              // Fallback to text logo if image fails
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          <div className="flex flex-col">
            <span className="h-display text-lg sm:text-xl tracking-tight text-bone group-hover:text-acid transition-colors">
              NV<span className="text-acid">|</span>BARBERS
            </span>
            <span className="font-mono text-[0.55rem] uppercase tracking-[0.35em] text-mute group-hover:text-acid transition-colors">
              LOYALTY CLUB
            </span>
          </div>
        </div>

        {/* View Switcher Chips matching NV aesthetic */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              sounds.playClick();
              onNavigate('/');
            }}
            className={`chip ${!isAdmin ? 'chip-active' : ''}`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Клиент</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              onNavigate('/admin');
            }}
            className={`chip ${isAdmin ? 'chip-active' : ''}`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Барбер (Админ)</span>
          </button>

          <a
            href="https://nvbarbers.eu/bg"
            target="_blank"
            rel="noopener noreferrer"
            title="Официален сайт на NV Barbers"
            className="chip hidden sm:inline-flex !px-2"
          >
            <ExternalLink className="w-3 h-3 text-mute hover:text-acid" />
          </a>
        </div>
      </div>
    </header>
  );
};
