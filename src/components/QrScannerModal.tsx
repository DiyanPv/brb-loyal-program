import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  const isStoppingRef = useRef(false);
  const readerElementId = 'barber-html5-qr-reader';

  // Prevent background scrolling on iOS and desktop when modal is active
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;

    document.body.classList.add('modal-lock-body');
    document.documentElement.classList.add('modal-lock-body');
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    const preventScroll = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName !== 'INPUT' && target?.tagName !== 'TEXTAREA') {
        e.preventDefault();
      }
    };

    window.addEventListener('touchmove', preventScroll, { passive: false });

    return () => {
      document.body.classList.remove('modal-lock-body');
      document.documentElement.classList.remove('modal-lock-body');
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      window.removeEventListener('touchmove', preventScroll);
    };
  }, [isOpen]);

  const cleanupScanner = useCallback(async () => {
    if (isStoppingRef.current) return;
    const currentScanner = scannerRef.current;
    if (currentScanner) {
      isStoppingRef.current = true;
      try {
        if (currentScanner.isScanning) {
          await currentScanner.stop();
        }
        currentScanner.clear();
      } catch (err) {
        console.warn('Scanner cleanup warning:', err);
      } finally {
        scannerRef.current = null;
        isStoppingRef.current = false;
      }
    }
  }, []);

  // Camera start / stop effect
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
        // Wait for DOM container to be fully rendered
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (!isMounted) return;

        const container = document.getElementById(readerElementId);
        if (!container) return;

        // Clean previous instances
        if (scannerRef.current) {
          await cleanupScanner();
        }

        const html5QrCode = new Html5Qrcode(readerElementId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scannerRef.current = html5QrCode;

        // Find best back camera or use environment facing mode
        let cameraTarget: any = { facingMode: 'environment' };
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            const backCam = cameras.find((c) =>
              /back|rear|environment|primary/i.test(c.label)
            );
            if (backCam) {
              cameraTarget = backCam.id;
            } else {
              cameraTarget = cameras[cameras.length - 1].id;
            }
          }
        } catch {
          // Fallback to { facingMode: "environment" }
        }

        const config = {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72);
            return { width: Math.max(edge, 180), height: Math.max(edge, 180) };
          },
          videoConstraints: {
            facingMode: { ideal: 'environment' },
          },
        };

        await html5QrCode.start(
          cameraTarget,
          config,
          (decodedText) => {
            sounds.playStampSound();
            if (typeof window !== 'undefined' && 'vibrate' in navigator) {
              try {
                navigator.vibrate(100);
              } catch {}
            }
            cleanupScanner();
            onScanSuccess(decodedText);
            onClose();
          },
          () => {}
        );

        if (isMounted) {
          setIsInitializing(false);

          // Fix iOS Safari video playback and playsinline
          setTimeout(() => {
            const video = document.querySelector<HTMLVideoElement>(`#${readerElementId} video`);
            if (video) {
              video.setAttribute('playsinline', 'true');
              video.setAttribute('webkit-playsinline', 'true');
              video.muted = true;
              video.autoplay = true;
              video.play().catch(() => {});
            }
          }, 150);
        }
      } catch (err: any) {
        console.warn('Camera QR start error:', err);
        if (isMounted) {
          setIsInitializing(false);
          setScanMode('manual');
          setErrorMsg(
            'Камерата не може да се стартира (липсват права в Safari/Chrome). Можете да въведете кода или телефона ръчно.'
          );
        }
      }
    };

    initScanner();

    return () => {
      isMounted = false;
      cleanupScanner();
    };
  }, [isOpen, scanMode, cleanupScanner, onClose, onScanSuccess]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCodeInput.trim();
    if (!clean) return;

    sounds.playStampSound();
    await cleanupScanner();
    onScanSuccess(clean);
    onClose();
  };

  const handleClose = async () => {
    await cleanupScanner();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in overscroll-none touch-none select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-sm bg-panel border border-line rounded-2xl p-5 shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
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
                cleanupScanner();
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
            onClick={handleClose}
            className="chip !px-2 !py-1 text-mute hover:!text-bone"
            title="Затвори"
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
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-panel/95 rounded-xl font-mono min-h-[280px]">
                <div className="w-8 h-8 border-2 border-acid border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs text-mute">Стартиране на задната камера...</p>
              </div>
            )}

            {/* Video Viewport Container */}
            <div className="relative w-full rounded-xl overflow-hidden border-2 border-acid/50 bg-black min-h-[280px]">
              <div id={readerElementId} className="w-full h-full min-h-[280px]" />

              {/* Laser Scan Guide Corners */}
              {!isInitializing && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border border-acid/40 rounded-lg relative">
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-acid" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-acid" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-acid" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-acid" />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between text-xs font-mono text-mute">
              <span>// Насочи към QR кода</span>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  cleanupScanner();
                  setScanMode('manual');
                }}
                className="text-acid hover:underline flex items-center gap-1 font-bold"
              >
                <span>Въведи код ръчно</span>
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
