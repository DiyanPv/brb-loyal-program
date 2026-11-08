import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
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

  // Lock body scroll on iOS/desktop while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
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

  // Camera start / pause effect
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

    const initScanner = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 200));
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
          setIsInitializing(false);
          return;
        }

        let cameraTarget: any = { facingMode: 'environment' };
        try {
          const cameras = await Html5Qrcode.getCameras().catch(() => []);
          if (cameras && cameras.length > 0) {
            const backCam = cameras.find((c) =>
              /back|rear|environment|primary/i.test(c.label)
            );
            cameraTarget = backCam ? backCam.id : cameras[cameras.length - 1].id;
          }
        } catch {
          cameraTarget = { facingMode: 'environment' };
        }

        // NO qrbox provided: scans the entire video frame, making detection 10x faster and broader!
        const config = {
          fps: 20,
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
              try { navigator.vibrate(100); } catch {}
            }
            stopScannerSilently().then(() => {
              onScanSuccess(decodedText);
              onClose();
            });
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
          }, 150);
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
  }, [isOpen, scanMode, fullCleanup, stopScannerSilently, onClose, onScanSuccess]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCodeInput.trim();
    if (!clean) return;

    sounds.playStampSound();
    await fullCleanup();
    onScanSuccess(clean);
    onClose();
  };

  const handleClose = async () => {
    await fullCleanup();
    onClose();
  };

  if (!isOpen) return null;

  // Render via createPortal directly into document.body to escape any parent CSS transforms
  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in overscroll-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-sm bg-panel border border-line rounded-2xl p-5 shadow-2xl overflow-hidden"
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

          <button
            onClick={handleClose}
            className="chip !px-2 !py-1 text-mute hover:!text-bone"
            title="Затвори"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && scanMode === 'manual' && (
          <div className="mb-4 p-3 rounded-xl bg-coal border border-line text-xs font-mono text-mute flex items-start space-x-2">
            <span className="text-acid">ℹ</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. CAMERA CONTAINER (Always mounted to prevent DOM null reference in html5-qrcode) */}
        <div className={scanMode === 'camera' ? 'block' : 'hidden'}>
          <div className="relative">
            {isInitializing && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-panel/95 rounded-xl font-mono min-h-[280px]">
                <div className="w-8 h-8 border-2 border-acid border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs text-mute">Стартиране на задната камера...</p>
              </div>
            )}

            <div className="relative w-full rounded-xl overflow-hidden border-2 border-acid/50 bg-black min-h-[280px]">
              <div id={readerElementId} className="w-full h-full min-h-[280px]" />

              {/* Laser Scan Guide Corners & Scanline */}
              {!isInitializing && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-52 h-52 border border-acid/50 rounded-xl relative overflow-hidden">
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
        </div>
      </div>
    </div>,
    document.body
  );
};
