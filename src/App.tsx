import React, { useState, useEffect } from 'react';
import { Customer } from './types';
import { LoyaltyService } from './services/loyaltyService';
import { getStoredAuthToken, clearStoredAuthToken } from './utils/session';
import { CustomerRegister } from './components/CustomerRegister';
import { CustomerCard } from './components/CustomerCard';
import { AdminPanel } from './components/AdminPanel';
import { Navbar } from './components/Navbar';

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Sync browser path with state & handle popstate
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
    }
  };

  // Initialize and check customer session on mount
  useEffect(() => {
    const initCustomer = async () => {
      setIsInitializing(true);
      const token = getStoredAuthToken();
      if (token) {
        try {
          const found = await LoyaltyService.getCustomerByAuthToken(token);
          if (found) {
            setCustomer(found);
          } else {
            clearStoredAuthToken();
            setCustomer(null);
          }
        } catch (err) {
          console.error('Error fetching customer by token:', err);
        }
      }
      setIsInitializing(false);
    };

    initCustomer();
  }, []);

  const handleCustomerLoaded = (c: Customer) => {
    setCustomer(c);
  };

  const handleLogout = () => {
    clearStoredAuthToken();
    setCustomer(null);
  };

  return (
    <div className="min-h-screen bg-ink text-bone flex flex-col font-sans selection:bg-acid selection:text-ink relative">
      {/* NV Brand Ambient Glow */}
      <div className="glow-brand fixed inset-0 pointer-events-none" aria-hidden="true" />

      {/* Top Navigation */}
      <Navbar currentPath={currentPath} onNavigate={navigateTo} />

      {/* Main Content Viewport */}
      <main className="flex-1 flex flex-col justify-center relative z-10">
        {isInitializing ? (
          <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in font-mono">
            <div className="w-12 h-12 rounded-full border-2 border-acid border-t-transparent animate-spin mb-4" />
            <p className="kicker !text-xs">
              Зареждане на картата...
            </p>
          </div>
        ) : currentPath === '/admin' ? (
          <AdminPanel onBackToClient={() => navigateTo('/')} />
        ) : customer ? (
          <CustomerCard initialCustomer={customer} onLogout={handleLogout} />
        ) : (
          <CustomerRegister onCustomerLoaded={handleCustomerLoaded} />
        )}
      </main>

      {/* Footer matching NV Barbers official site */}
      <footer className="border-t border-line bg-coal py-8 relative z-10">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <p className="h-display text-lg text-bone">
              N<span className="text-acid">|</span>V BARBERS
            </p>
            <p className="font-mono text-xs text-brand mt-0.5">
              Не просто фейд.
            </p>
            <p className="font-mono text-[11px] text-mute mt-1">
              София (Студентски град · Малинова долина · Манастирски ливади · Дианабад) × Созопол
            </p>
          </div>

          <div className="flex flex-col items-center sm:items-end gap-1.5">
            <div className="flex items-center gap-2">
              <a
                href="https://instagram.com/nv.barbers"
                target="_blank"
                rel="noopener noreferrer"
                className="chip !text-[10px]"
              >
                Instagram
              </a>
              <a
                href="https://nvbarbers.eu/bg"
                target="_blank"
                rel="noopener noreferrer"
                className="chip !text-[10px]"
              >
                nvbarbers.eu
              </a>
            </div>
            <p className="font-mono text-[10px] text-mute">
              © 2026 ЕН ВИ СТАЙЛ ЕООД · Лоялна Програма
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
