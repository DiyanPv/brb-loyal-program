import React, { useState } from 'react';
import { Customer } from '../types';
import { LoyaltyService } from '../services/loyaltyService';
import { setStoredAuthToken } from '../utils/session';
import { User, Phone, ShieldCheck, ArrowRight } from 'lucide-react';
import { sounds } from '../utils/audio';

interface CustomerRegisterProps {
  onCustomerLoaded: (customer: Customer) => void;
}

export const CustomerRegister: React.FC<CustomerRegisterProps> = ({ onCustomerLoaded }) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = fullName.trim();
    const cleanPhone = phone.trim().replace(/[\s\-()]/g, '');

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
      const customer = await LoyaltyService.registerCustomer(cleanName, cleanPhone);
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

      {/* Registration Card in NV Card Style */}
      <div className="card-nv relative border border-line bg-panel p-6 sm:p-8 rounded-2xl shadow-2xl">
        {/* Subtle acid accent corner tag */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-line">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-bone font-bold">
              Вход / Нова Карта
            </span>
            <p className="text-[11px] text-mute font-mono mt-0.5">
              // БЕЗ ПАРОЛА • 1 КЛИК
            </p>
          </div>
          <span className="chip chip-active text-[10px]">
            NV VIP PASS
          </span>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3 bg-red-950/50 border border-red-500/50 text-red-300 text-xs font-mono flex items-center space-x-2 animate-shake">
            <span>⚠</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name */}
          <div>
            <label className="label-nv">
              Две Имена (Клиент)
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
              Телефонен Номер
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
            <p className="text-[11px] text-mute mt-2 flex items-center gap-1.5 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-acid" />
              <span>Ако вече имаш карта, печатите се възстановяват автоматично.</span>
            </p>
          </div>

          {/* Submit Button with NV Shears Watermark */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-acid w-full relative overflow-hidden rounded-xl !py-4 text-sm mt-3 disabled:opacity-60 cursor-pointer"
          >
            {/* NV Barbers Shears SVG Silhouette Watermark */}
            <svg
              viewBox="0 0 64 64"
              className="pointer-events-none absolute -right-2 top-1/2 h-14 w-14 -translate-y-1/2 rotate-[24deg] text-ink/15"
              fill="none"
              aria-hidden="true"
            >
              <g transform="translate(32,38)">
                <g transform="rotate(-8)">
                  <path
                    d="M -1.4 1.4 L -5.5 -26.4 Q -6 -29.5 -3.4 -30 Q -1.3 -30.3 -0.9 -27.5 L 2.5 -0.4 Q 2.8 1.6 0.5 2 Z"
                    fill="currentColor"
                  />
                  <circle cx="6.9" cy="12.8" r="4.6" stroke="currentColor" strokeWidth="2.7" fill="none" />
                </g>
                <g transform="rotate(8)">
                  <path
                    d="M 1.4 1.4 L 5.5 -26.4 Q 6 -29.5 3.4 -30 Q 1.3 -30.3 0.9 -27.5 L -2.5 -0.4 Q -2.8 1.6 -0.5 2 Z"
                    fill="currentColor"
                  />
                  <circle cx="-6.9" cy="12.8" r="4.6" stroke="currentColor" strokeWidth="2.7" fill="none" />
                </g>
                <circle r="2.5" fill="currentColor" />
              </g>
            </svg>

            <span className="relative z-10 inline-flex items-center gap-2">
              {isLoading ? (
                <span>Зареждане...</span>
              ) : (
                <>
                  <span>Отвори дигиталната карта</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </span>
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-line text-center">
          <p className="font-mono text-[11px] text-mute">
            Картата се запазва автоматично на телефона ти за 365 дни.
          </p>
        </div>
      </div>
    </div>
  );
};
