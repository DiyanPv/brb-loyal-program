import React, { useState } from 'react';
import { Customer } from '../types';
import { LoyaltyService } from '../services/loyaltyService';
import { setStoredAuthToken } from '../utils/session';
import { User, Phone, ShieldCheck, ArrowRight, Lock, Mail, LogIn, UserPlus } from 'lucide-react';
import { sounds } from '../utils/audio';

interface CustomerRegisterProps {
  onCustomerLoaded: (customer: Customer) => void;
}

export const CustomerRegister: React.FC<CustomerRegisterProps> = ({ onCustomerLoaded }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanIdentifier = loginIdentifier.trim();
    if (!cleanIdentifier) {
      setErrorMsg('Моля, въведете имейл, потребителско име или телефон.');
      return;
    }

    setIsLoading(true);
    sounds.playClick();

    try {
      const res = await LoyaltyService.loginCustomer(cleanIdentifier, loginPassword.trim() || undefined);
      if (res.success && res.customer) {
        setStoredAuthToken(res.customer.AuthToken);
        sounds.playRewardSound();
        onCustomerLoaded(res.customer);
      } else {
        setErrorMsg(res.message || 'Грешка при вход. Моля, проверете данните си.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg('Възникна грешка при вход. Моля, опитайте отново.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Register
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = fullName.trim();
    const cleanPhone = phone.trim().replace(/[\s\-()]/g, '');
    const cleanEmailOrUser = emailOrUsername.trim();

    if (!cleanName || cleanName.length < 3) {
      setErrorMsg('Моля, въведете две имена (напр. Александър Петров)');
      return;
    }

    if (!cleanPhone || cleanPhone.length < 8) {
      setErrorMsg('Моля, въведете валиден телефонен номер (напр. 0888 123 456)');
      return;
    }

    setIsLoading(true);
    sounds.playClick();

    try {
      const isEmail = cleanEmailOrUser.includes('@');
      const email = isEmail ? cleanEmailOrUser : undefined;
      const username = !isEmail && cleanEmailOrUser ? cleanEmailOrUser : undefined;

      const customer = await LoyaltyService.registerCustomer(
        cleanName,
        cleanPhone,
        email,
        username,
        registerPassword.trim() || undefined
      );

      setStoredAuthToken(customer.AuthToken);
      sounds.playRewardSound();
      onCustomerLoaded(customer);
    } catch (err) {
      console.error('Registration error:', err);
      setErrorMsg('Възникна грешка при регистрацията. Моля, опитайте отново.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-8 sm:py-12 animate-fade-in">
      {/* NV Barbers Hero Kicker & Headlines */}
      <div className="mb-8">
        <p className="kicker mb-3">БАРБЕРШОП • СОФИЯ × СОЗОПОЛ</p>
        <h1 className="h-display text-4xl sm:text-6xl text-bone">
          <span className="text-stroke block">НЕ ПРОСТО</span>
          <span className="block text-acid">ФЕЙД.</span>
        </h1>
        <p className="mt-4 text-mute text-sm sm:text-base max-w-md leading-relaxed font-sans">
          Дигитална карта за лоялност на <strong className="text-bone">NV Barbers</strong>. Вземи печат при всяко подстригване и отключи ексклузивни отстъпки.
        </p>

        {/* Locations quick ribbon */}
        <div className="mt-5 flex flex-wrap gap-2 text-[0.65rem] font-mono uppercase tracking-[0.18em] text-mute">
          <span className="chip !px-2.5 !py-1 text-acid border-line">5 локации</span>
          <span className="chip !px-2.5 !py-1">Студентски град</span>
          <span className="chip !px-2.5 !py-1">Малинова долина</span>
          <span className="chip !px-2.5 !py-1">Манастирски ливади</span>
          <span className="chip !px-2.5 !py-1">Дианабад</span>
          <span className="chip !px-2.5 !py-1">Созопол</span>
        </div>
      </div>

      {/* Registration & Login Card in NV Card Style */}
      <div className="card-nv relative border border-line bg-panel p-6 sm:p-8 rounded-2xl shadow-2xl">
        {/* Auth Mode Switcher Tabs */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-line">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setAuthMode('login');
                setErrorMsg(null);
              }}
              className={`chip !text-xs font-mono ${authMode === 'login' ? 'chip-active' : ''}`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Вход</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setAuthMode('register');
                setErrorMsg(null);
              }}
              className={`chip !text-xs font-mono ${authMode === 'register' ? 'chip-active' : ''}`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Нова Карта</span>
            </button>
          </div>

          <span className="chip text-[10px] text-acid border-line">
            NV VIP PASS
          </span>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3 bg-red-950/50 border border-red-500/50 text-red-300 text-xs font-mono flex items-center space-x-2 animate-shake rounded-xl">
            <span>⚠</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. LOGIN FORM */}
        {authMode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4 animate-fade-in font-sans">
            <div>
              <label className="label-nv">
                Имейл, Потребителско Име или Телефон
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="напр. 0897827242 или marin@example.com"
                  className="field rounded-xl font-mono text-sm"
                />
                <User className="w-4 h-4 text-mute absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="label-nv flex items-center justify-between">
                <span>Парола</span>
                <span className="text-[10px] text-mute font-normal normal-case">(ако имате зададена)</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="field rounded-xl font-mono text-sm"
                />
                <Lock className="w-4 h-4 text-mute absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-acid w-full rounded-xl !py-4 text-sm mt-4 disabled:opacity-60 cursor-pointer shadow-acid-hard"
            >
              {isLoading ? (
                <span>Влизане...</span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <span>Влез в твоята карта</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </button>

            <div className="pt-3 text-center">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setAuthMode('register');
                }}
                className="text-xs font-mono text-mute hover:text-acid transition-colors underline"
              >
                Нямаш карта още? Регистрирай нова карта тук →
              </button>
            </div>
          </form>
        ) : (
          /* 2. REGISTRATION FORM */
          <form onSubmit={handleRegisterSubmit} className="space-y-4 animate-fade-in font-sans">
            {/* Full Name */}
            <div>
              <label className="label-nv">
                Две Имена (Клиент) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="напр. Александър Петров"
                  className="field rounded-xl font-sans"
                />
                <User className="w-4 h-4 text-mute absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="label-nv">
                Телефонен Номер *
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0888 123 456"
                  className="field rounded-xl font-mono"
                />
                <Phone className="w-4 h-4 text-mute absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Email / Username (Optional) */}
            <div>
              <label className="label-nv flex items-center justify-between">
                <span>Имейл или Потребителско Име</span>
                <span className="text-[10px] text-mute font-normal normal-case">(по избор)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  placeholder="напр. alex@gmail.com или alex99"
                  className="field rounded-xl font-sans"
                />
                <Mail className="w-4 h-4 text-mute absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Password (Optional) */}
            <div>
              <label className="label-nv flex items-center justify-between">
                <span>Парола за защита на картата</span>
                <span className="text-[10px] text-mute font-normal normal-case">(по избор)</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  placeholder="••••••••"
                  className="field rounded-xl font-mono"
                />
                <Lock className="w-4 h-4 text-mute absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <p className="text-[11px] text-mute mt-1 flex items-center gap-1.5 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-acid shrink-0" />
              <span>Ако вече имаш карта с този телефон или имейл, печатите се възстановяват автоматично.</span>
            </p>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-acid w-full rounded-xl !py-4 text-sm mt-4 disabled:opacity-60 cursor-pointer shadow-acid-hard"
            >
              {isLoading ? (
                <span>Регистрация...</span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <span>Създай дигитална карта</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </button>

            <div className="pt-3 text-center">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setAuthMode('login');
                }}
                className="text-xs font-mono text-mute hover:text-acid transition-colors underline"
              >
                Вече имаш акаунт? Влез тук →
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-line text-center">
          <p className="font-mono text-[11px] text-mute">
            Картата се запазва автоматично на телефона ти за 365 дни.
          </p>
        </div>
      </div>
    </div>
  );
};
