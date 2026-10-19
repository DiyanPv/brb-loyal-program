import React, { useEffect } from 'react';
import { BarberStampIcon } from './BarberStampIcon';
import { Sparkles, Gift, CheckCircle2 } from 'lucide-react';

interface StampCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStamps: number;
  requiredStamps: number;
  discountText: string;
  isRewardUnlocked: boolean;
}

export const StampCelebrationModal: React.FC<StampCelebrationModalProps> = ({
  isOpen,
  onClose,
  currentStamps,
  requiredStamps,
  discountText,
  isRewardUnlocked,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    // Auto-dismiss after 2.8 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 2800);

    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const remaining = Math.max(0, requiredStamps - currentStamps);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md cursor-pointer animate-fade-in"
    >
      {/* Shockwave Rings in Background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="w-[320px] h-[320px] sm:w-[480px] sm:h-[480px] rounded-full border border-acid/40 animate-ping opacity-60" />
        <div className="w-[200px] h-[200px] sm:w-[320px] sm:h-[320px] rounded-full bg-acid/10 blur-2xl animate-pulse" />
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm bg-panel border-2 border-acid rounded-3xl p-7 text-center shadow-acid-glow-lg overflow-hidden animate-stamp-impact"
      >
        {/* Top Kicker Tag */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-acid text-ink font-mono text-[10px] uppercase font-black tracking-widest mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isRewardUnlocked ? 'ОТКЛЮЧЕНА НАГРАДА' : 'НОВ ПЕЧАТ // УСПЕХ'}</span>
        </div>

        {/* Central Stamp Display with animated impact */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-28 h-28 rounded-full bg-acid/20 blur-xl animate-pulse" />
          </div>

          <BarberStampIcon
            size={110}
            isNew={true}
            color="#b6ff2e"
            glow={true}
          />
        </div>

        {/* Headlines */}
        {isRewardUnlocked ? (
          <div className="space-y-2 mt-2">
            <h2 className="h-display text-3xl sm:text-4xl text-acid leading-none">
              {discountText}
            </h2>
            <p className="font-mono text-xs uppercase font-bold text-bone tracking-wide">
              НА СЛЕДВАЩИЯ ТИ ФЕЙД В NV BARBERS!
            </p>
            <div className="mt-3 p-2.5 rounded-xl bg-acid/15 border border-acid text-[11px] font-mono text-acid font-semibold flex items-center justify-center gap-1.5">
              <Gift className="w-4 h-4 shrink-0" />
              <span>Покажи картата на барбера за отстъпка</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2 mt-2">
            <h2 className="h-display text-2xl sm:text-3xl text-bone">
              +1 ПЕЧАТ ДОБАВЕН!
            </h2>
            <p className="font-mono text-sm font-bold text-acid">
              {currentStamps} от {requiredStamps} събрани печата
            </p>
            {remaining > 0 ? (
              <p className="font-mono text-[11px] text-mute mt-1">
                // Още <span className="text-acid font-bold">{remaining}</span> {remaining === 1 ? 'печат' : 'печата'} до {discountText} награда!
              </p>
            ) : null}
          </div>
        )}

        {/* Tap to dismiss hint */}
        <div className="mt-6 pt-3 border-t border-line flex items-center justify-center gap-1.5 text-mute font-mono text-[10px]">
          <CheckCircle2 className="w-3 h-3 text-acid" />
          <span>Докосни за затваряне</span>
        </div>
      </div>
    </div>
  );
};
