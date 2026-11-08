import React, { useEffect, useState, useRef } from 'react';
import { Customer, ShopSettings } from '../types';
import { BarberStampIcon } from './BarberStampIcon';
import { StampCelebrationModal } from './StampCelebrationModal';
import { QRCodeSVG } from 'qrcode.react';
import { triggerStampSparks, triggerGrandFireworks } from '../utils/celebrations';
import { sounds } from '../utils/audio';
import { LoyaltyService } from '../services/loyaltyService';
import {
  Gift,
  QrCode,
  LogOut,
  Award,
  Calendar,
  Share2,
  CheckCircle2,
  Download
} from 'lucide-react';

interface CustomerCardProps {
  initialCustomer: Customer;
  onLogout: () => void;
}

export const CustomerCard: React.FC<CustomerCardProps> = ({ initialCustomer, onLogout }) => {
  const [customer, setCustomer] = useState<Customer>(initialCustomer);
  const [settings, setSettings] = useState<ShopSettings>({
    Id: 'default',
    RequiredStamps: 5,
    DiscountText: '-50%',
    CooldownHours: 24,
    AdminPin: '1234',
  });
  const [lastAnimatedIndex, setLastAnimatedIndex] = useState<number | null>(null);
  const [showQrExpanded, setShowQrExpanded] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isCelebrationOpen, setIsCelebrationOpen] = useState(false);
  const [isCardTrembling, setIsCardTrembling] = useState(false);

  // Track previous stamps to trigger realtime reactions
  const prevStampsRef = useRef(customer.CurrentStamps);
  const prevRewardRef = useRef(customer.HasRewardAvailable);

  // Load Settings
  useEffect(() => {
    LoyaltyService.getSettings().then((s) => setSettings(s));
    const unsubscribeSettings = LoyaltyService.subscribeToSettings((newSettings) => {
      setSettings(newSettings);
    });
    return () => {
      unsubscribeSettings();
    };
  }, []);

  // Realtime subscription to customer updates
  useEffect(() => {
    const unsubscribeCustomer = LoyaltyService.subscribeToCustomer(customer.Id, (updated) => {
      const prevStamps = prevStampsRef.current;
      const prevReward = prevRewardRef.current;

      // Check if new stamp was added
      if (updated.CurrentStamps > prevStamps) {
        const newlyAddedIndex = updated.CurrentStamps - 1;
        setLastAnimatedIndex(newlyAddedIndex);

        // Tactile card impact tremor
        setIsCardTrembling(true);
        setTimeout(() => setIsCardTrembling(false), 500);

        // Tactile Haptic Vibration
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate([150, 70, 250]);
          } catch {}
        }

        // Play stamp thump sound
        sounds.playStampSound();

        // Open dramatic celebration popup
        setIsCelebrationOpen(true);

        // Check if reward unlocked
        if (updated.HasRewardAvailable && !prevReward) {
          triggerGrandFireworks();
          sounds.playRewardSound();
        } else {
          // Electric spark fireworks
          triggerStampSparks(0.5, 0.42);
        }
      } else if (updated.HasRewardAvailable && !prevReward) {
        triggerGrandFireworks();
        sounds.playRewardSound();
        setIsCelebrationOpen(true);
      }

      prevStampsRef.current = updated.CurrentStamps;
      prevRewardRef.current = updated.HasRewardAvailable;
      setCustomer(updated);
    });

    return () => {
      unsubscribeCustomer();
    };
  }, [customer.Id]);

  // PWA install prompt handler
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        setDeferredPrompt(null);
      });
    } else {
      alert('За да запазиш картата на началния екран:\n- В Safari (iOS): Натисни "Сподели" (Share) и избери "Добавяне към началния екран".\n- В Chrome (Android): Натисни менюто (3 точки) и избери "Инсталиране на приложение".');
    }
  };

  const qrPayload = `barber-loyalty://stamp/${customer.AuthToken}?name=${encodeURIComponent(customer.FullName)}&phone=${encodeURIComponent(customer.Phone)}&stamps=${customer.CurrentStamps}&id=${encodeURIComponent(customer.Id)}`;

  const copyQrValue = () => {
    sounds.playClick();
    navigator.clipboard.writeText(customer.AuthToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2500);
  };

  const isRewardReady = customer.HasRewardAvailable || customer.CurrentStamps >= settings.RequiredStamps;
  const stampsCount = Math.min(customer.CurrentStamps, settings.RequiredStamps);
  const slotsArray = Array.from({ length: settings.RequiredStamps }, (_, i) => i);

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-6 animate-fade-in space-y-6">
      {/* Top Customer Info Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-line">
        <div>
          <span className="kicker !text-[0.65rem]">
            NV LOYALTY PASS
          </span>
          <h2 className="h-display text-xl sm:text-2xl text-bone mt-0.5">
            {customer.FullName}
          </h2>
        </div>

        <div className="flex items-center space-x-2">
          {/* Total visits chip */}
          <div className="chip !text-acid !border-line font-mono">
            <Award className="w-3.5 h-3.5" />
            <span>{customer.TotalVisits}</span>
            <span className="text-[10px] text-mute">посещения</span>
          </div>

          {/* Logout / Switch Card */}
          <button
            onClick={onLogout}
            title="Смяна на клиент / Изход"
            className="chip hover:!border-red-400 hover:!text-red-400 !px-2.5"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ACTIVE REWARD BANNER (NV BRUTALIST ACID STYLE) */}
      {isRewardReady && (
        <div className="relative overflow-hidden rounded-2xl bg-acid text-ink p-6 border-2 border-brand shadow-acid-glow-lg animate-pulse-acid">
          {/* Shears background watermark */}
          <svg
            viewBox="0 0 64 64"
            className="pointer-events-none absolute -right-3 -bottom-3 h-28 w-28 rotate-12 text-ink/10"
            fill="none"
          >
            <circle cx="20" cy="40" r="12" stroke="currentColor" strokeWidth="4" />
            <circle cx="44" cy="40" r="12" stroke="currentColor" strokeWidth="4" />
            <path d="M28 32 L48 8 M36 32 L16 8" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
          </svg>

          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-ink text-acid rounded-full font-mono text-[0.65rem] font-bold uppercase tracking-widest mb-3">
              <Gift className="w-3.5 h-3.5 animate-bounce" />
              <span>ГОТОВА НАГРАДА</span>
            </div>

            <h3 className="h-display text-3xl sm:text-4xl text-ink font-black leading-none">
              {settings.DiscountText}
            </h3>

            <p className="font-mono text-xs text-ink/90 font-bold mt-2 uppercase tracking-wide">
              НА СЛЕДВАЩИЯ ТИ ФЕЙД В NV BARBERS
            </p>

            <p className="text-[11px] font-mono text-ink/80 mt-2 bg-black/10 py-1.5 px-3 rounded-lg inline-block">
              Покажи QR кода долу на твоя барбер при плащане!
            </p>
          </div>
        </div>
      )}

      {/* VIRTUAL LOYALTY CARD (NV BARBERS STYLE) */}
      <div className={`card-nv relative rounded-2xl p-6 sm:p-7 border ${
        isRewardReady ? 'border-acid shadow-acid-glow' : 'border-line shadow-2xl'
      } ${isCardTrembling ? 'animate-shake' : ''} bg-panel overflow-hidden transition-all duration-300`}>
        {/* Top Card Accents */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full bg-acid animate-ping" />
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-acid font-bold">
              // NV CLUB CARD
            </span>
          </div>

          <div className="text-right font-mono">
            <span className="text-sm font-black text-bone">
              <span className="text-acid">{stampsCount}</span> / {settings.RequiredStamps}
            </span>
            <span className="text-[10px] text-mute block uppercase tracking-wider">
              Печата
            </span>
          </div>
        </div>

        {/* Progress Bar (Acid Lime) */}
        <div className="w-full h-2 rounded-full bg-coal mb-6 overflow-hidden p-0.5 border border-line">
          <div
            className="h-full rounded-full bg-acid shadow-[0_0_12px_rgba(182,255,46,0.6)] transition-all duration-700 ease-out"
            style={{ width: `${(stampsCount / settings.RequiredStamps) * 100}%` }}
          />
        </div>

        {/* STAMPS SLOTS GRID */}
        <div className="mb-7">
          <div
            className={`grid gap-3 items-center justify-center ${
              settings.RequiredStamps <= 5
                ? 'grid-cols-5'
                : settings.RequiredStamps <= 7
                ? 'grid-cols-4 sm:grid-cols-7'
                : 'grid-cols-4'
            }`}
          >
            {slotsArray.map((slotIndex) => {
              const isStamped = slotIndex < stampsCount;
              const isJustStamped = slotIndex === lastAnimatedIndex;

              return (
                <div key={slotIndex} className="flex flex-col items-center justify-center">
                  <div
                    onClick={() => {
                      if (isStamped) {
                        sounds.playStampSound();
                        triggerStampSparks(0.5, 0.38);
                      }
                    }}
                    className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isStamped
                        ? 'bg-ink border-2 border-acid shadow-stamp-glow cursor-pointer active:scale-95'
                        : 'bg-coal border-2 border-dashed border-line hover:border-mute'
                    }`}
                  >
                    {isStamped ? (
                      <BarberStampIcon
                        size={52}
                        isNew={isJustStamped}
                        color="#b6ff2e"
                        glow={isJustStamped || isRewardReady}
                      />
                    ) : (
                      <div className="text-center select-none font-mono">
                        <span className="text-xs font-bold text-mute">
                          #{slotIndex + 1}
                        </span>
                        {slotIndex === settings.RequiredStamps - 1 && (
                          <Gift className="w-3 h-3 text-acid mx-auto mt-0.5" />
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-mute mt-1.5">
                    {slotIndex === settings.RequiredStamps - 1 ? (
                      <span className="text-acid font-bold">{settings.DiscountText}</span>
                    ) : (
                      `Печат ${slotIndex + 1}`
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* QR CODE SECTION */}
        <div className="pt-5 border-t border-line text-center">
          <p className="font-mono text-xs text-mute mb-4 flex items-center justify-center gap-1.5 uppercase tracking-wider font-semibold">
            <QrCode className="w-4 h-4 text-acid" />
            <span>Сканирай при твоя барбер</span>
          </p>

          <div
            className="inline-block relative p-3 rounded-xl bg-white shadow-2xl border-2 border-acid cursor-pointer transition-transform hover:scale-105 active:scale-95"
            onClick={() => setShowQrExpanded(!showQrExpanded)}
            title="Кликни за увеличение"
          >
            <QRCodeSVG
              value={qrPayload}
              size={showQrExpanded ? 240 : 170}
              level="H"
              includeMargin={false}
              className="rounded transition-all duration-300"
            />

            {/* NV Signature Corner Brackets */}
            <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-ink" />
            <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-ink" />
            <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-ink" />
            <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-ink" />
          </div>

          <div className="mt-4 flex flex-col items-center justify-center gap-2">
            {/* Quick manual typing code for the barber */}
            <div className="p-3 rounded-xl bg-coal border border-line w-full max-w-xs text-center font-mono">
              <span className="text-[10px] text-mute uppercase tracking-widest block font-bold">
                // НОМЕР ЗА РЪЧНО ВЪВЕЖДАНЕ
              </span>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-base font-black text-acid tracking-wider bg-black/40 px-2 py-0.5 rounded border border-line">
                  #{customer.AuthToken.replace('bl_', '').slice(-6).toUpperCase()}
                </span>
                <span className="text-[11px] text-mute">или</span>
                <span className="text-xs font-bold text-bone bg-black/40 px-2 py-0.5 rounded border border-line">
                  {customer.Phone}
                </span>
              </div>
              <p className="text-[10px] text-mute/80 mt-1.5">
                Диктувай този номер, ако камерата на барбера не работи
              </p>
            </div>

            <button
              onClick={copyQrValue}
              className="chip !text-[11px] font-mono mt-1"
            >
              {copiedToken ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-acid" />
                  <span className="text-acid">Копирано!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Копирай клиентски код</span>
                </>
              )}
            </button>
          </div>

          {/* Last visit date */}
          {customer.LastVisitAt && (
            <p className="font-mono text-[11px] text-mute mt-3 flex items-center justify-center gap-1">
              <Calendar className="w-3 h-3 text-brand" />
              <span>Последно посещение: {new Date(customer.LastVisitAt).toLocaleString('bg-BG', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</span>
            </p>
          )}
        </div>
      </div>

      {/* PWA INSTALL CHIP BANNER */}
      <div className="card-nv p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <div className="text-xs">
          <p className="font-bold text-bone font-mono flex items-center justify-center sm:justify-start gap-1.5 uppercase">
            <span>Добави на начален екран</span>
          </p>
          <p className="text-[11px] text-mute mt-0.5 font-sans">
            За да показваш картата за 1 секунда при всяко влизане в салона.
          </p>
        </div>

        <button
          onClick={handleInstallClick}
          className="btn btn-acid !py-2 !px-4 text-xs shrink-0 cursor-pointer rounded-lg"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Инсталирай</span>
        </button>
      </div>

      {/* OFFICIAL TICKER RIBBON MATCHING NVBARBERS.EU */}
      <div className="overflow-hidden border-y border-line bg-ink py-2.5 select-none" aria-hidden="true">
        <div className="flex w-max whitespace-nowrap animate-marquee">
          <span className="h-display text-sm text-brand pr-4">
            НЕ ПРОСТО ФЕЙД — NV BARBERS — СОФИЯ — СОЗОПОЛ — LOYALTY CLUB — НЕ ПРОСТО ФЕЙД — NV BARBERS — СОФИЯ — СОЗОПОЛ —
          </span>
          <span className="h-display text-sm text-brand pr-4">
            НЕ ПРОСТО ФЕЙД — NV BARBERS — СОФИЯ — СОЗОПОЛ — LOYALTY CLUB — НЕ ПРОСТО ФЕЙД — NV BARBERS — СОФИЯ — СОЗОПОЛ —
          </span>
        </div>
      </div>

      {/* DYNAMIC CELEBRATION MODAL WITH SHOCKWAVE & STAMP IMPACT */}
      <StampCelebrationModal
        isOpen={isCelebrationOpen}
        onClose={() => setIsCelebrationOpen(false)}
        currentStamps={customer.CurrentStamps}
        requiredStamps={settings.RequiredStamps}
        discountText={settings.DiscountText}
        isRewardUnlocked={customer.HasRewardAvailable}
      />
    </div>
  );
};
