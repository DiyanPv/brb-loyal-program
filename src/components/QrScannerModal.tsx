import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Keyboard, ArrowRight } from 'lucide-react';
import { sounds } from '../utils/audio';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'barber-html5-qr-reader';

  // Camera initialization
  useEffect(() => {
    if (!isOpen || scanMode !== 'camera') {
      cleanupScanner();
      return;
    }

    let isMounted = true;
    setIsInitializing(true);
    setErrorMsg(null);

    const initScanner = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 200));

        if (!isMounted) return;

        const html5QrCode = new Html5Qrcode(readerElementId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scannerRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            sounds.playStampSound();
            if (typeof window !== 'undefined' && 'vibrate' in navigator) {
              try {
                navigator.vibrate(100);
              } catch {}
            }
            onScanSuccess(decodedText);
            cleanupScanner();
            onClose();
          },
          () => {}
        );

        if (isMounted) {
          setIsInitializing(false);
        }
      } catch (err: any) {
        console.warn('Camera QR start error, switching to manual input:', err);
        if (isMounted) {
          setIsInitializing(false);
          // Automatically switch to manual input if camera access fails!
          setScanMode('manual');
          setErrorMsg(
            'Камерата не е достъпна (липсват права или камера). Можеш да въведеш номера на картата или телефона ръчно.'
          );
        }
      }
    };

    initScanner();

    return () => {
      isMounted = false;
      cleanupScanner();
    };
  }, [isOpen, scanMode]);

  const cleanupScanner = () => {
    if (scannerRef.current) {
      if (scannerRef.current.isScanning) {
        scannerRef.current.stop().catch((err) => console.warn('Scanner stop error:', err));
      }
      scannerRef.current.clear();
      scannerRef.current = null;
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCodeInput.trim();
    if (!clean) return;

    sounds.playStampSound();
    onScanSuccess(clean);
    cleanupScanner();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-panel border border-line rounded-2xl p-5 shadow-2xl overflow-hidden">
        {/* Top Header & Mode Toggles */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-line">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setScanMode('camera');
              }}
              className={`chip !text-[11px] font-mono ${
                scanMode === 'camera' ? 'chip-active' : ''
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Камера</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setScanMode('manual');
              }}
              className={`chip !text-[11px] font-mono ${
                scanMode === 'manual' ? 'chip-active' : ''
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Ръчен код</span>
            </button>
          </div>

          <button
            onClick={() => {
              cleanupScanner();
              onClose();
            }}
            className="chip !px-2 !py-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informative notification if camera was blocked */}
        {errorMsg && scanMode === 'manual' && (
          <div className="mb-4 p-3 rounded-xl bg-coal border border-line text-xs font-mono text-mute flex items-start space-x-2">
            <span className="text-acid">ℹ</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. CAMERA SCANNER MODE */}
        {scanMode === 'camera' ? (
          <div className="relative">
            {isInitializing && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-panel/95 rounded-xl font-mono">
                <div className="w-8 h-8 border-2 border-acid border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs text-mute">Стартиране на задната камера...</p>
              </div>
            )}

            {/* Video Viewport */}
            <div
              id={readerElementId}
              className="w-full rounded-xl overflow-hidden border-2 border-acid/50 bg-black min-h-[280px]"
            />

            <div className="mt-3 flex items-center justify-between text-xs font-mono text-mute">
              <span>// Насочи към QR кода</span>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setScanMode('manual');
                }}
                className="text-acid hover:underline flex items-center gap-1 font-bold"
              >
                <span>Или въведи код ръчно</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ) : (
          /* 2. MANUAL NUMBER / CODE ENTRY MODE */
          <form onSubmit={handleManualSubmit} className="space-y-4 py-2 font-mono animate-fade-in">
            <div className="text-center pb-2">
              <div className="w-12 h-12 rounded-full bg-coal border border-line flex items-center justify-center mx-auto mb-2 text-acid">
                <Keyboard className="w-6 h-6" />
              </div>
              <h3 className="h-display text-base text-bone">
                ВЪВЕДИ КОД ОТ КАРТАТА
              </h3>
              <p className="text-xs text-mute mt-1">
                Въведи номера под QR кода на клиента или неговия телефон:
              </p>
            </div>

            <div>
              <label className="label-nv">
                Номер на Карта / Телефон:
              </label>
              <input
                type="text"
                required
                autoFocus
                value={manualCodeInput}
                onChange={(e) => setManualCodeInput(e.target.value)}
                placeholder="напр. #A1B2C3 или 0888123456"
                className="field rounded-xl text-center text-lg font-bold font-mono tracking-wider text-acid placeholder:text-xs placeholder:tracking-normal placeholder:font-sans"
              />
            </div>

            <button
              type="submit"
              className="btn btn-acid w-full rounded-xl !py-3.5 text-xs font-bold shadow-acid-hard cursor-pointer"
            >
              <span>ДОБАВИ ПЕЧАТ (С КОД)</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="pt-2 text-center text-[11px] text-mute">
              Системата разпознава автоматично кода на картата или телефонния номер.
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
