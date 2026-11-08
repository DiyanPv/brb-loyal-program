import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Keyboard, ArrowRight, RefreshCw } from 'lucide-react';
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
  const [availableCameras, setAvailableCameras] = useState<{ id: string; label: string }[]>([]);
  const [activeCamIndex, setActiveCamIndex] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef(false);
  const hasScannedRef = useRef(false);
  const readerElementId = 'barber-html5-qr-reader';

  // Lock body scroll on iOS/desktop while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalWidth = document.body.style.width;

    document.body.style.overflow = 'hidden';
    document.body.style.width = '100%';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.width = originalWidth;
    };
  }, [isOpen]);

  const stopScannerSilently = useCallback(async () => {
    if (isStoppingRef.current) return;
    const currentScanner = scannerRef.current;
    if (currentScanner) {
      isStoppingRef.current = true;
      try {
        if (currentScanner.isScanning) {
          await currentScanner.stop().catch(() => {});
        }
      } catch (err) {
        console.warn('Silent scanner stop error:', err);
      } finally {
        isStoppingRef.current = false;
      }
    }
  }, []);

  const fullCleanup = useCallback(async () => {
    await stopScannerSilently();
    try {
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    } catch (err) {
      console.warn('Scanner clear error:', err);
    } finally {
      scannerRef.current = null;
    }
  }, [stopScannerSilently]);

  // Enumerate cameras once on open
  useEffect(() => {
    if (!isOpen) return;
    Html5Qrcode.getCameras()
      .then((cams) => {
        if (cams && cams.length > 0) {
          setAvailableCameras(cams);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  // Camera start / restart effect
  useEffect(() => {
    if (!isOpen) {
      fullCleanup();
      return;
    }

    if (scanMode !== 'camera') {
      stopScannerSilently();
      return;
    }

    let isMounted = true;
    setIsInitializing(true);
    setErrorMsg(null);
    hasScannedRef.current = false;

    const initScanner = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 150));
        if (!isMounted) return;

        const container = document.getElementById(readerElementId);
        if (!container) return;

        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode(readerElementId, {
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
            verbose: false,
          });
        }

        const html5QrCode = scannerRef.current;
        if (html5QrCode.isScanning) {
          await stopScannerSilently();
        }

        // Camera target strategy:
        // Use environment facingMode by default for native 1x autofocus lens
        // If user explicitly flips cameras, use the selected deviceId
        let cameraTarget: any = { facingMode: 'environment' };
        if (availableCameras.length > 1 && availableCameras[activeCamIndex]) {
          cameraTarget = availableCameras[activeCamIndex].id;
        }

        // Optimal scanning configuration:
        // 12 FPS gives mobile Safari plenty of headroom for ZXing decode
        // QR box 75% optimizes CPU decode region
        const config = {
          fps: 12,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const boxSize = Math.max(160, Math.floor(minEdge * 0.72));
            return { width: boxSize, height: boxSize };
          },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          cameraTarget,
          config,
          (decodedText) => {
            if (hasScannedRef.current) return;
            hasScannedRef.current = true;

            sounds.playStampSound();
            if (typeof window !== 'undefined' && 'vibrate' in navigator) {
              try {
                navigator.vibrate([80, 40, 100]);
              } catch {}
            }

            // Immediately invoke callback and close modal without awaiting camera teardown
            onScanSuccess(decodedText);
            onClose();

            // Background teardown
            stopScannerSilently();
          },
          () => {}
        );

        if (isMounted) {
          setIsInitializing(false);
          setTimeout(() => {
            const video = document.querySelector<HTMLVideoElement>(`#${readerElementId} video`);
            if (video) {
              video.setAttribute('playsinline', 'true');
              video.setAttribute('webkit-playsinline', 'true');
              video.muted = true;
              video.autoplay = true;
              video.play().catch(() => {});
            }
          }, 100);
        }
      } catch (err: any) {
        console.warn('Camera start error:', err);
        if (isMounted) {
          setIsInitializing(false);
          setScanMode('manual');
          setErrorMsg(
            'Камерата не може да се стартира на това устройство. Можете да въведете кода или телефона от картата ръчно.'
          );
        }
      }
    };

    initScanner();

    return () => {
      isMounted = false;
      stopScannerSilently();
    };
  }, [isOpen, scanMode, activeCamIndex, availableCameras, fullCleanup, stopScannerSilently, onClose, onScanSuccess]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCodeInput.trim();
    if (!clean) return;

    sounds.playStampSound();
    onScanSuccess(clean);
    onClose();
    fullCleanup();
  };

  const handleClose = async () => {
    fullCleanup();
    onClose();
  };

  const toggleCamera = () => {
    if (availableCameras.length <= 1) return;
    sounds.playClick();
    setActiveCamIndex((prev) => (prev + 1) % availableCameras.length);
  };

  if (!isOpen) return null;

  // Render via createPortal directly into document.body with 100dvh for true iOS Safari vertical centering
  return createPortal(
    <div
      className="fixed inset-0 z-[99999] h-[100dvh] w-screen flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md overscroll-none touch-none select-none animate-fade-in"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        touchAction: 'none',
        overscrollBehavior: 'none',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-sm bg-panel border border-line rounded-2xl p-4 sm:p-5 shadow-2xl overflow-hidden my-auto max-h-[92dvh] flex flex-col justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Tabs */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-line">
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

          <div className="flex items-center gap-1.5">
            {availableCameras.length > 1 && scanMode === 'camera' && (
              <button
                type="button"
                onClick={toggleCamera}
                className="chip !px-2 !py-1 text-mute hover:!text-bone"
                title="Смени камера"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={handleClose}
              className="chip !px-2 !py-1 text-mute hover:!text-bone"
              title="Затвори"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {errorMsg && scanMode === 'manual' && (
          <div className="mb-3 p-3 rounded-xl bg-coal border border-line text-xs font-mono text-mute flex items-start space-x-2">
            <span className="text-acid">ℹ</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. CAMERA CONTAINER */}
        <div className={scanMode === 'camera' ? 'block' : 'hidden'}>
          <div className="relative">
            {isInitializing && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-panel/95 rounded-xl font-mono min-h-[260px]">
                <div className="w-8 h-8 border-2 border-acid border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs text-mute">Стартиране на задната камера...</p>
              </div>
            )}

            <div className="relative w-full rounded-xl overflow-hidden border-2 border-acid/50 bg-black min-h-[260px] aspect-square flex items-center justify-center">
              <div id={readerElementId} className="w-full h-full min-h-[260px]" />

              {/* Laser Scan Guide Corners & Scanline */}
              {!isInitializing && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border border-acid/50 rounded-xl relative overflow-hidden">
                    {/* Corner Reticles */}
                    <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-acid" />
                    <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-acid" />
                    <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-acid" />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-acid" />

                    {/* Laser line moving vertically */}
                    <div className="absolute left-0 right-0 h-0.5 bg-acid shadow-[0_0_10px_#b6ff2e] animate-laser" />
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
                  setScanMode('manual');
                }}
                className="text-acid hover:underline flex items-center gap-1 font-bold"
              >
                <span>Въведи код ръчно</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* 2. MANUAL NUMBER / CODE ENTRY FORM */}
        <div className={scanMode === 'manual' ? 'block' : 'hidden'}>
          <form onSubmit={handleManualSubmit} className="space-y-4 py-2 font-mono animate-fade-in">
            <div className="text-center pb-1">
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

            <div className="pt-1 text-center text-[11px] text-mute">
              Системата разпознава автоматично кода на картата или телефонния номер.
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};
