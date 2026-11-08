import React, { useState, useEffect, useMemo } from 'react';
import { Customer, ShopSettings, VisitLog, StampResult } from '../types';
import { LoyaltyService } from '../services/loyaltyService';
import { isFirebaseConfigured } from '../lib/firebase';
import { QrScannerModal } from './QrScannerModal';
import { sounds } from '../utils/audio';
import { isAdminAuthenticated, setAdminAuthenticated } from '../utils/session';
import confetti from 'canvas-confetti';
import {
  Camera,
  Search,
  Users,
  Settings,
  Gift,
  Clock,
  KeyRound,
  LogOut,
  Phone,
  CheckCircle,
  AlertTriangle,
  Database,
  History,
  Plus,
  ArrowRight,
  Trash2
} from 'lucide-react';

interface AdminPanelProps {
  onBackToClient: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBackToClient }) => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(isAdminAuthenticated());
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Tabs: 'dashboard' | 'customers' | 'settings'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'customers' | 'settings'>('dashboard');

  // Core Data
  const [settings, setSettings] = useState<ShopSettings>({
    Id: 'default',
    RequiredStamps: 5,
    DiscountText: '-50%',
    CooldownHours: 24,
    AdminPin: '1234',
  });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [inlineCodeInput, setInlineCodeInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Modals & Feedback
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [cooldownModalData, setCooldownModalData] = useState<{
    customer: Customer;
    hoursSinceLastVisit?: number;
    authToken: string;
  } | null>(null);
  const [selectedCustomerLogs, setSelectedCustomerLogs] = useState<{
    customer: Customer;
    logs: VisitLog[];
  } | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
    customer?: Customer;
  } | null>(null);

  // Settings form states
  const [settingsForm, setSettingsForm] = useState<ShopSettings>(settings);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState(false);

  // Load Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [currSettings, allCustomers] = await Promise.all([
        LoyaltyService.getSettings(),
        LoyaltyService.getAllCustomers(),
      ]);
      setSettings(currSettings);
      setSettingsForm(currSettings);
      setCustomers(allCustomers);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();

      // Realtime list subscription
      const unsubCustomers = LoyaltyService.subscribeToCustomersList((updatedList) => {
        setCustomers(updatedList);
      });
      const unsubSettings = LoyaltyService.subscribeToSettings((updatedSettings) => {
        setSettings(updatedSettings);
        setSettingsForm(updatedSettings);
      });

      return () => {
        unsubCustomers();
        unsubSettings();
      };
    }
  }, [isAuthenticated]);

  // Auto-dismiss action feedback after 6 seconds
  useEffect(() => {
    if (!actionFeedback) return;
    const timer = setTimeout(() => {
      setActionFeedback(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [actionFeedback]);

  // Handle PIN Login
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playClick();
    if (pinInput.trim() === settings.AdminPin) {
      setIsAuthenticated(true);
      setAdminAuthenticated(true);
      setPinError(false);
      setPinInput('');
    } else {
      setPinError(true);
      sounds.playStampSound();
      setPinInput('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAdminAuthenticated(false);
  };

  // Helper to extract AuthToken from QR payload
  const parseQrToken = (rawText: string): string => {
    const trimmed = rawText.trim();
    if (trimmed.startsWith('barber-loyalty://stamp/')) {
      return trimmed.replace('barber-loyalty://stamp/', '').trim();
    }
    return trimmed;
  };

  // 1. Process QR Scan
  const handleQrScanSuccess = async (rawDecodedText: string) => {
    const token = parseQrToken(rawDecodedText);
    await executeStampAction(token, false);
  };

  // 1.1 Process Manual Code / Phone Input
  const handleInlineCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inlineCodeInput.trim();
    if (!clean) return;
    setInlineCodeInput('');
    await executeStampAction(clean, false);
  };

  // 2. Execute Stamp Action (handles cooldown check)
  const executeStampAction = async (authToken: string, overrideCooldown = false) => {
    sounds.playClick();
    const result: StampResult = await LoyaltyService.addStamp(authToken, overrideCooldown);

    if (result.cooldownTriggered && result.customer) {
      setCooldownModalData({
        customer: result.customer,
        hoursSinceLastVisit: result.hoursSinceLastVisit,
        authToken,
      });
      return;
    }

    if (result.success && result.customer) {
      sounds.playStampSound();
      if (result.rewardUnlocked) {
        sounds.playRewardSound();
        try {
          confetti({
            particleCount: 75,
            spread: 70,
            origin: { y: 0.5 },
            colors: ['#b6ff2e', '#6fb300', '#ededed'],
          });
        } catch {}
      }

      setActionFeedback({
        type: 'success',
        message: result.message,
        customer: result.customer,
      });
      setCooldownModalData(null);
      await loadData();
    } else {
      setActionFeedback({
        type: 'error',
        message: result.message || 'Грешка при добавяне на печат.',
      });
    }
  };

  // 3. Redeem Reward Action
  const handleRedeemReward = async (customer: Customer) => {
    if (!window.confirm(`Приложи ${settings.DiscountText} за ${customer.FullName} и нулирай картата?`)) {
      return;
    }

    sounds.playClick();
    const res = await LoyaltyService.redeemReward(customer.Id);
    if (res.success) {
      sounds.playRewardSound();
      setActionFeedback({
        type: 'success',
        message: res.message,
        customer: res.customer,
      });
      await loadData();
    } else {
      setActionFeedback({
        type: 'error',
        message: res.message,
      });
    }
  };

  // 4. View Customer Logs
  const handleViewLogs = async (customer: Customer) => {
    sounds.playClick();
    const logs = await LoyaltyService.getVisitLogs(customer.Id);
    setSelectedCustomerLogs({ customer, logs });
  };

  // 5. Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playClick();
    try {
      const updated = await LoyaltyService.updateSettings({
        RequiredStamps: Number(settingsForm.RequiredStamps),
        DiscountText: settingsForm.DiscountText,
        CooldownHours: Number(settingsForm.CooldownHours),
        AdminPin: settingsForm.AdminPin,
      });
      setSettings(updated);
      setSettingsSavedMsg(true);
      setTimeout(() => setSettingsSavedMsg(false), 3000);
      await loadData();
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  // 6. Clear All Data (Full Reset)
  const [isClearingData, setIsClearingData] = useState(false);
  const handleClearAllData = async () => {
    const confirmed = window.confirm(
      'ВНИМАНИЕ: Това действие ще изтрие абсолютно всички клиенти и история на посещенията от базата данни (Firestore). Сигурни ли сте, че искате да нулирате всичко?'
    );
    if (!confirmed) return;

    setIsClearingData(true);
    try {
      await LoyaltyService.clearAllData();
      setCustomers([]);
      setActionFeedback({
        type: 'success',
        message: 'Базата данни беше напълно изчистена! Всички клиенти са изтрити (0 клиенти).',
      });
      sounds.playClick();
    } catch (err) {
      console.error('Failed to clear database:', err);
      setActionFeedback({
        type: 'error',
        message: 'Възникна грешка при изчистване на базата данни.',
      });
    } finally {
      setIsClearingData(false);
    }
  };

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return customers;
    const qTranslit = LoyaltyService.transliterate(q);
    return customers.filter(
      (c) =>
        c.FullName.toLowerCase().includes(q) ||
        LoyaltyService.transliterate(c.FullName).includes(qTranslit) ||
        c.Phone.includes(q) ||
        (c.Email && c.Email.toLowerCase().includes(q)) ||
        (c.Username && c.Username.toLowerCase().includes(q)) ||
        c.AuthToken.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  const readyRewardsCount = useMemo(
    () => customers.filter((c) => c.HasRewardAvailable || c.CurrentStamps >= settings.RequiredStamps).length,
    [customers, settings.RequiredStamps]
  );

  const totalVisitsCount = useMemo(
    () => customers.reduce((sum, c) => sum + c.TotalVisits, 0),
    [customers]
  );

  // =========================================================================
  // PIN LOGIN SCREEN (NV BARBERS STYLE)
  // =========================================================================
  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-sm mx-auto px-4 py-16 animate-fade-in text-center">
        <div className="w-16 h-16 rounded-full bg-coal border border-line flex items-center justify-center mx-auto mb-4 shadow-sm">
          <KeyRound className="w-7 h-7 text-acid" />
        </div>
        <p className="kicker mb-1">NV BARBERS // STAFF</p>
        <h2 className="h-display text-3xl text-bone">
          ВХОД БАРБЕР
        </h2>
        <p className="font-mono text-xs text-mute mt-1 uppercase tracking-wider">
          Въведи PIN за достъп
        </p>

        <form onSubmit={handlePinSubmit} className="mt-8 space-y-4">
          <div>
            <input
              type="password"
              maxLength={6}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="PIN код (default: 1234)"
              autoFocus
              className="field rounded-xl text-center text-xl font-mono tracking-[0.5em] text-bone placeholder:tracking-normal placeholder:text-xs placeholder:font-sans"
            />
          </div>

          {pinError && (
            <p className="text-xs text-red-400 font-mono flex items-center justify-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Грешен PIN код. Опитай отново!</span>
            </p>
          )}

          <button
            type="submit"
            className="btn btn-acid w-full rounded-xl !py-3.5 text-sm"
          >
            <span>ВХОД В СИСТЕМАТА</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onBackToClient}
            className="w-full py-2.5 font-mono text-xs text-mute hover:text-acid transition-colors"
          >
            ← Към клиентската карта
          </button>
        </form>
      </div>
    );
  }

  // =========================================================================
  // MAIN ADMIN INTERFACE
  // =========================================================================
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-acid animate-pulse" />
            <span className="kicker !text-[0.65rem]">
              NV BARBERS • ОПЕРАТИВЕН ПАНЕЛ
            </span>
          </div>
          <h1 className="h-display text-2xl sm:text-3xl text-bone mt-1">
            Администрация
          </h1>
        </div>

        <div className="flex items-center space-x-2">
          {/* Database status badge */}
          <div className="chip !text-[10px] font-mono">
            <Database className="w-3 h-3 text-acid" />
            <span>{isFirebaseConfigured() ? 'Firebase Firestore (На живо)' : 'Локален Режим (Демо)'}</span>
          </div>

          <button
            onClick={onBackToClient}
            className="chip hover:!text-acid"
          >
            Карта
          </button>

          <button
            onClick={handleLogout}
            title="Изход от админ"
            className="chip hover:!border-red-400 hover:!text-red-400 !px-2.5"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ACTION FEEDBACK FLOATING TOAST (SAFE AREA CENTERED) */}
      {actionFeedback && (
        <div
          className="fixed left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 z-[99999] max-w-sm sm:max-w-md w-auto pointer-events-auto animate-fade-in"
          style={{ top: 'calc(env(safe-area-inset-top, 20px) + 16px)' }}
        >
          <div
            className={`p-3.5 sm:p-4 rounded-2xl border shadow-2xl flex items-center justify-between gap-3 font-mono text-xs backdrop-blur-xl break-words overflow-hidden ${
              actionFeedback.type === 'success'
                ? 'bg-ink/95 border-acid text-acid shadow-acid-glow'
                : actionFeedback.type === 'warning'
                ? 'bg-ink/95 border-amber-500 text-amber-200 shadow-xl'
                : 'bg-ink/95 border-red-500 text-red-200 shadow-xl'
            }`}
          >
            <div className="flex items-center space-x-3 min-w-0">
              {actionFeedback.type === 'success' ? (
                <div className="w-8 h-8 rounded-full bg-acid/20 border border-acid flex items-center justify-center shrink-0">
                  <CheckCircle className="w-5 h-5 text-acid" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-sm text-bone break-words">{actionFeedback.message}</p>
                {actionFeedback.customer && (
                  <p className="opacity-90 text-[11px] mt-0.5 text-acid font-bold truncate">
                    {actionFeedback.customer.FullName} ({actionFeedback.customer.Phone}) • Печати:{' '}
                    {actionFeedback.customer.CurrentStamps}/{settings.RequiredStamps}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setActionFeedback(null)}
              className="chip !px-2 !py-1 text-bone hover:!text-acid ml-2 shrink-0 cursor-pointer"
              title="Затвори"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* NAVIGATION TABS (NV BARBERS STYLE) */}
      <div className="flex border-b border-line gap-2">
        <button
          onClick={() => {
            sounds.playClick();
            setActiveTab('dashboard');
          }}
          className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-mono text-xs uppercase tracking-wider font-bold transition-all cursor-pointer ${
            activeTab === 'dashboard'
              ? 'border-acid text-acid bg-acid/5'
              : 'border-transparent text-mute hover:text-bone'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Бързо Табло</span>
        </button>

        <button
          onClick={() => {
            sounds.playClick();
            setActiveTab('customers');
          }}
          className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-mono text-xs uppercase tracking-wider font-bold transition-all cursor-pointer ${
            activeTab === 'customers'
              ? 'border-acid text-acid bg-acid/5'
              : 'border-transparent text-mute hover:text-bone'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Клиенти ({customers.length})</span>
          {readyRewardsCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-acid text-ink text-[10px] font-black flex items-center justify-center">
              {readyRewardsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            sounds.playClick();
            setActiveTab('settings');
          }}
          className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-mono text-xs uppercase tracking-wider font-bold transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'border-acid text-acid bg-acid/5'
              : 'border-transparent text-mute hover:text-bone'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Настройки</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: QUICK DASHBOARD */}
      {/* =================================================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* BIG SCAN BUTTON */}
          <div className="card-nv relative rounded-2xl p-6 sm:p-8 text-center overflow-hidden border-line">
            <div className="max-w-md mx-auto">
              <span className="kicker mb-2">
                СВЕТКАВИЧНО СКАНИРАНЕ // 0.5 СЕК
              </span>
              <h2 className="h-display text-2xl sm:text-3xl text-bone mb-6">
                СКАНИРАЙ КЛИЕНТСКИ QR
              </h2>

              <button
                onClick={() => {
                  sounds.playClick();
                  setIsScannerOpen(true);
                }}
                className="btn btn-acid w-full relative overflow-hidden rounded-xl !py-5 text-base shadow-acid-hard cursor-pointer"
              >
                {/* NV Shears SVG Watermark */}
                <svg
                  viewBox="0 0 64 64"
                  className="pointer-events-none absolute -right-2 top-1/2 h-14 w-14 -translate-y-1/2 rotate-[24deg] text-ink/15"
                  fill="none"
                >
                  <circle cx="20" cy="40" r="12" stroke="currentColor" strokeWidth="4" />
                  <circle cx="44" cy="40" r="12" stroke="currentColor" strokeWidth="4" />
                  <path d="M28 32 L48 8 M36 32 L16 8" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                </svg>

                <div className="relative z-10 flex items-center justify-center space-x-3">
                  <Camera className="w-6 h-6 text-ink" />
                  <span>СКАНИРАЙ ЗА ПЕЧАТ</span>
                </div>
              </button>

              {/* Quick Manual Code / Phone Typing Form (Alternative if camera is not working) */}
              <div className="mt-5 pt-4 border-t border-line">
                <p className="font-mono text-[11px] text-mute mb-2 uppercase tracking-wider font-semibold">
                  // РЪЧНО ВЪВЕЖДАНЕ (АКО КАМЕРАТА НЕ РАБОТИ)
                </p>
                <form onSubmit={handleInlineCodeSubmit} className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={inlineCodeInput}
                      onChange={(e) => setInlineCodeInput(e.target.value)}
                      placeholder="Въведи име (напр. Марин), код (#BO9Z5Z) или тел..."
                      className="field rounded-xl font-mono text-xs text-acid placeholder:text-mute placeholder:font-sans !py-2.5"
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-acid !py-2.5 !px-4 text-xs rounded-xl shrink-0 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Печат с код</span>
                  </button>
                </form>
              </div>

              <p className="font-mono text-xs text-mute mt-4 flex items-center justify-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand" />
                <span>Защита: {settings.CooldownHours}ч Cooldown период между печатите</span>
              </p>
            </div>
          </div>

          {/* BACKUP QUICK SEARCH SECTION */}
          <div className="card-nv rounded-2xl p-5 space-y-4">
            <div>
              <h3 className="h-display text-lg text-bone flex items-center gap-2">
                <Search className="w-4 h-4 text-acid" />
                <span>Резервен вариант: Търсачка</span>
              </h3>
              <p className="font-mono text-xs text-mute mt-1">
                // По телефон или име (при паднала батерия на клиента)
              </p>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Търси по първи цифри на телефон или име..."
                className="field rounded-xl font-mono text-xs"
              />
              <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-mute pointer-events-none" />
            </div>

            {/* Quick Results */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {filteredCustomers.length === 0 ? (
                <div className="p-4 text-center font-mono text-xs text-mute bg-coal rounded-xl">
                  Няма намерени клиенти.
                </div>
              ) : (
                filteredCustomers.slice(0, 8).map((customer) => {
                  const hasReward = customer.HasRewardAvailable || customer.CurrentStamps >= settings.RequiredStamps;

                  return (
                    <div
                      key={customer.Id}
                      className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        hasReward
                          ? 'bg-acid/10 border-acid'
                          : 'bg-coal/90 border-line hover:border-brand'
                      }`}
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-bone">
                            {customer.FullName}
                          </span>
                          {hasReward && (
                            <span className="chip chip-active !text-[10px] !py-0.5">
                              Готова награда!
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-3 font-mono text-xs text-mute mt-1">
                          <a
                            href={`tel:${customer.Phone}`}
                            className="hover:text-acid flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3 text-brand" />
                            <span>{customer.Phone}</span>
                          </a>
                          <span>•</span>
                          <span className="text-acid font-bold">
                            {customer.CurrentStamps} / {settings.RequiredStamps} печата
                          </span>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center space-x-2 shrink-0">
                        {hasReward && (
                          <button
                            onClick={() => handleRedeemReward(customer)}
                            className="btn btn-acid !py-1.5 !px-3 text-xs rounded-lg"
                          >
                            <Gift className="w-3.5 h-3.5" />
                            <span>Приложи {settings.DiscountText}</span>
                          </button>
                        )}

                        <button
                          onClick={() => executeStampAction(customer.AuthToken, true)}
                          className="btn btn-ghost !py-1.5 !px-3 text-xs rounded-lg"
                        >
                          <Plus className="w-3.5 h-3.5 text-acid" />
                          <span>+1 Печат (Ръчно)</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: CRM CUSTOMERS TABLE */}
      {/* =================================================================== */}
      {activeTab === 'customers' && (
        <div className="space-y-5">
          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="card-nv p-4 rounded-xl">
              <span className="kicker !text-[0.65rem] block mb-1">
                Общо Регистрирани
              </span>
              <span className="h-display text-3xl text-bone">
                {customers.length}
              </span>
            </div>

            <div className="card-nv p-4 rounded-xl !border-acid/60 bg-acid/5">
              <span className="kicker !text-[0.65rem] !text-acid block mb-1">
                Активни Награди за Усвояване
              </span>
              <span className="h-display text-3xl text-acid">
                {readyRewardsCount}
              </span>
            </div>

            <div className="card-nv p-4 rounded-xl">
              <span className="kicker !text-[0.65rem] block mb-1">
                Общ Брой Посещения
              </span>
              <span className="h-display text-3xl text-bone">
                {totalVisitsCount}
              </span>
            </div>
          </div>

          {/* Table Header & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Филтрирай клиенти..."
                className="field rounded-xl font-mono text-xs !py-2"
              />
              <Search className="w-3.5 h-3.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-mute" />
            </div>
            <span className="font-mono text-xs text-mute self-end sm:self-center">
              Показване на {filteredCustomers.length} от {customers.length} клиента
            </span>
          </div>

          {/* CRM Table */}
          <div className="overflow-x-auto rounded-xl border border-line bg-panel">
            <table className="w-full text-left font-mono text-xs text-bone">
              <thead className="bg-coal text-[10px] uppercase tracking-wider text-mute border-b border-line">
                <tr>
                  <th className="py-3 px-4">Име и Телефон</th>
                  <th className="py-3 px-4">Печати</th>
                  <th className="py-3 px-4">Посещения</th>
                  <th className="py-3 px-4">Последно посещение</th>
                  <th className="py-3 px-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-mute font-mono">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 border-2 border-acid border-t-transparent rounded-full animate-spin" />
                        <span>Зареждане на клиенти...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-mute font-mono">
                      Няма регистрирани клиенти.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => {
                    const hasReward = customer.HasRewardAvailable || customer.CurrentStamps >= settings.RequiredStamps;

                    return (
                      <tr key={customer.Id} className="hover:bg-coal/60 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-bold text-bone text-sm font-sans">
                            {customer.FullName}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] mt-0.5">
                            <a
                              href={`tel:${customer.Phone}`}
                              className="text-acid hover:underline flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3 text-brand" />
                              <span>{customer.Phone}</span>
                            </a>
                            {customer.Email && (
                              <span className="text-mute">
                                • {customer.Email}
                              </span>
                            )}
                            {customer.Username && !customer.Email && (
                              <span className="text-mute">
                                • @{customer.Username}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {hasReward ? (
                            <span className="chip chip-active !text-[10px] !py-0.5">
                              {settings.DiscountText} Готова!
                            </span>
                          ) : (
                            <span className="font-bold text-acid">
                              {customer.CurrentStamps} / {settings.RequiredStamps}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {customer.TotalVisits}
                        </td>

                        <td className="py-3 px-4 text-mute">
                          {customer.LastVisitAt
                            ? new Date(customer.LastVisitAt).toLocaleString('bg-BG', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Няма'}
                        </td>

                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {hasReward && (
                            <button
                              onClick={() => handleRedeemReward(customer)}
                              title="Усвои наградата"
                              className="btn btn-acid !py-1 !px-2.5 text-[11px] rounded"
                            >
                              Усвои
                            </button>
                          )}

                          <button
                            onClick={() => executeStampAction(customer.AuthToken, true)}
                            title="Добави 1 печат"
                            className="btn btn-ghost !py-1 !px-2.5 text-[11px] rounded"
                          >
                            +1 Печат
                          </button>

                          <button
                            onClick={() => handleViewLogs(customer)}
                            title="История на посещенията"
                            className="chip !px-2 !py-1"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: SETTINGS */}
      {/* =================================================================== */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveSettings} className="card-nv rounded-2xl p-6 space-y-6">
            <div className="border-b border-line pb-4">
              <span className="kicker mb-1">КОНФИГУРАЦИЯ</span>
              <h3 className="h-display text-xl text-bone">
                Настройки на Лоялната Програма
              </h3>
              <p className="font-mono text-xs text-mute mt-1">
                // Обновява се в реално време на клиентските екрани
              </p>
            </div>

            {settingsSavedMsg && (
              <div className="p-3 rounded-xl bg-acid/10 border border-acid text-acid font-mono text-xs flex items-center space-x-2 animate-fade-in">
                <CheckCircle className="w-4 h-4 text-acid" />
                <span>Настройките бяха запазени успешно!</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Required Stamps */}
              <div>
                <label className="label-nv">
                  Брой печати за награда
                </label>
                <div className="flex items-center space-x-2 mb-2">
                  {[5, 7].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSettingsForm({ ...settingsForm, RequiredStamps: num })}
                      className={`chip ${
                        settingsForm.RequiredStamps === num ? 'chip-active' : ''
                      }`}
                    >
                      {num} Печата
                    </button>
                  ))}
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={settingsForm.RequiredStamps}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, RequiredStamps: Math.max(2, parseInt(e.target.value) || 5) })
                    }
                    className="w-20 field rounded-xl text-center font-mono text-xs !py-1.5"
                  />
                </div>
                <p className="font-mono text-[11px] text-mute">
                  * При намаляване на прага, клиентите с достатъчно печати веднага отключват награда.
                </p>
              </div>

              {/* Discount Text */}
              <div>
                <label className="label-nv">
                  Размер / Текст на наградата
                </label>
                <input
                  type="text"
                  value={settingsForm.DiscountText}
                  onChange={(e) => setSettingsForm({ ...settingsForm, DiscountText: e.target.value })}
                  placeholder="напр. -50% или Безплатен фейд"
                  className="field rounded-xl font-mono text-xs"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {['-50%', '-30%', '-100%', 'Безплатно оформяне на брада'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setSettingsForm({ ...settingsForm, DiscountText: preset })}
                      className="chip !text-[10px] !py-0.5"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cooldown Hours */}
              <div>
                <label className="label-nv">
                  Cooldown период (в часове)
                </label>
                <input
                  type="number"
                  min={0}
                  max={168}
                  value={settingsForm.CooldownHours}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, CooldownHours: Math.max(0, parseInt(e.target.value) || 0) })
                  }
                  className="field rounded-xl font-mono text-xs"
                />
                <p className="font-mono text-[11px] text-mute mt-1">
                  Период за защита от повторно сканиране (default: 24ч).
                </p>
              </div>

              {/* Admin PIN */}
              <div>
                <label className="label-nv">
                  PIN код за Админ Панела
                </label>
                <input
                  type="password"
                  maxLength={8}
                  value={settingsForm.AdminPin}
                  onChange={(e) => setSettingsForm({ ...settingsForm, AdminPin: e.target.value })}
                  className="field rounded-xl font-mono text-xs"
                />
                <p className="font-mono text-[11px] text-mute mt-1">
                  Текущ PIN: <span className="text-acid font-bold">{settings.AdminPin}</span>
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-line flex justify-end">
              <button
                type="submit"
                className="btn btn-acid rounded-xl"
              >
                ЗАПАЗИ НАСТРОЙКИТЕ
              </button>
            </div>
          </form>

          {/* Danger Zone: Full Database Reset */}
          <div className="card-nv rounded-2xl p-6 space-y-4 border-red-500/40 bg-red-950/20">
            <div>
              <div className="flex items-center space-x-2">
                <Trash2 className="w-4 h-4 text-red-400" />
                <span className="kicker !text-red-400">ОПАСНА ЗОНА // ПЪЛЕН РЕСТАРТ</span>
              </div>
              <h4 className="h-display text-lg text-bone mt-1">
                Изчисти всички клиенти и история
              </h4>
              <p className="font-mono text-xs text-mute mt-1 leading-relaxed">
                Изтрива перманентно всички регистрирани клиенти и логове на посещения от базата данни (Firebase Firestore) и локалното кеширане. Приложението стартира на чисто с 0 клиенти.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleClearAllData}
                disabled={isClearingData}
                className="btn !bg-red-500/20 hover:!bg-red-500/30 text-red-300 border border-red-500/50 rounded-xl text-xs py-2.5 px-4 flex items-center space-x-2 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
                <span>{isClearingData ? 'Изчистване на базата...' : 'ИЗЧИСТИ ВСИЧКИ КЛИЕНТИ (0 КЛИЕНТИ)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COOLDOWN WARNING MODAL */}
      {cooldownModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-panel border-2 border-brand rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-acid/20 text-acid flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>

            <div className="text-center">
              <p className="kicker !text-[0.65rem] mb-1">ЗАЩИТА ОТ ИЗМАМИ</p>
              <h3 className="h-display text-xl text-bone">
                Cooldown Период Активен
              </h3>
              <p className="font-mono text-xs text-mute mt-2">
                Клиентът <span className="font-bold text-bone">{cooldownModalData.customer.FullName}</span> вече е получил печат преди{' '}
                <span className="font-bold text-acid">{cooldownModalData.hoursSinceLastVisit} часа</span> (по-малко от задължителните {settings.CooldownHours} часа).
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => executeStampAction(cooldownModalData.authToken, true)}
                className="btn btn-acid w-full rounded-xl text-xs"
              >
                ДОБАВИ ПЕЧАТ ВЪПРЕКИ ТОВА (OVERRIDE)
              </button>

              <button
                onClick={() => setCooldownModalData(null)}
                className="btn btn-ghost w-full rounded-xl text-xs"
              >
                Отказ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER HISTORY LOGS MODAL */}
      {selectedCustomerLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg bg-panel border border-line rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="h-display text-base text-bone">
                  Дневник на Посещенията
                </h3>
                <p className="font-mono text-xs text-acid mt-0.5">
                  {selectedCustomerLogs.customer.FullName} ({selectedCustomerLogs.customer.Phone})
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomerLogs(null)}
                className="chip !px-2"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2 pr-1 font-mono text-xs">
              {selectedCustomerLogs.logs.length === 0 ? (
                <p className="text-mute py-6 text-center">
                  Няма регистрирани събития в дневника за този клиент.
                </p>
              ) : (
                selectedCustomerLogs.logs.map((log) => (
                  <div
                    key={log.Id}
                    className="p-3 rounded-xl bg-coal border border-line flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2">
                      {log.ActionType === 'RewardRedeemed' ? (
                        <Gift className="w-4 h-4 text-acid shrink-0" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-brand shrink-0" />
                      )}
                      <div>
                        <span className="font-bold text-bone">
                          {log.ActionType === 'RewardRedeemed'
                            ? 'Усвоена отстъпка'
                            : 'Добавен печат'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-mute">
                      {new Date(log.CreatedAt).toLocaleString('bg-BG')}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-line text-right">
              <button
                onClick={() => setSelectedCustomerLogs(null)}
                className="btn btn-ghost !py-2 !px-4 text-xs rounded-xl"
              >
                Затвори
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR CAMERA SCANNER MODAL */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleQrScanSuccess}
      />
    </div>
  );
};
