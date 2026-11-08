import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import jsQR from 'jsqr';
import { X, Camera, Keyboard, ArrowRight, RefreshCw, Image as ImageIcon } from 'lucide-react';
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
  const [isScanSuccess, setIsScanSuccess] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [scannedCustomerName, setScannedCustomerName] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameId = useRef<number | null>(null);
  const hasScannedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Lock body scroll on iOS/desktop while modal is open (prevent touchmove for complete iOS Safari lock)
  useEffect(() => {
    if (!isOpen) return;

    const preventTouch = (e: TouchEvent) => {
      // Allow touching form inputs if in manual mode
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      e.preventDefault();
    };

    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalWidth = document.body.style.width;

    document.body.style.overflow = 'hidden';
    document.body.style.width = '100%';

    window.addEventListener('touchmove', preventTouch, { passive: false });

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.width = originalWidth;
      window.removeEventListener('touchmove', preventTouch);
    };
  }, [isOpen]);

  // Cleanly stop media tracks and animation loop
  const stopCamera = useCallback(() => {
    if (animFrameId.current) {
      cancelAnimationFrame(animFrameId.current);
      animFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleFoundCode = useCallback(
    (codeText: string) => {
      if (hasScannedRef.current) return;
      hasScannedRef.current = true;

      let detectedName: string | null = null;
      try {
        const jsonStart = codeText.indexOf('{');
        const jsonEnd = codeText.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          const parsed = JSON.parse(codeText.slice(jsonStart, jsonEnd + 1));
          if (parsed.name) detectedName = parsed.name;
        }
      } catch {}

      if (detectedName) {
        setScannedCustomerName(detectedName);
      }

      setIsScanSuccess(true);
      sounds.playStampSound();
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([100, 50, 150]);
        } catch {}
      }

      stopCamera();

      // Show visual confirmation for 950ms so barber clearly sees the success screen
      setTimeout(() => {
        onScanSuccess(codeText);
        onClose();
        setIsScanSuccess(false);
        setScannedCustomerName(null);
      }, 950);
    },
    [onScanSuccess, onClose, stopCamera]
  );

  // Scan loop: tests hardware BarcodeDetector, center full-res crop, then full frame
  const startScanningLoop = useCallback(() => {
    let lastScanTimestamp = 0;
    const scanIntervalMs = 70; // ~14 fps

    const scanCanvas = (ctx: CanvasRenderingContext2D, width: number, height: number): string | null => {
      try {
        const imgData = ctx.getImageData(0, 0, width, height);
        const qr = jsQR(imgData.data, width, height, {
          inversionAttempts: 'attemptBoth',
        });
        if (qr && qr.data && qr.data.trim()) {
          return qr.data.trim();
        }
      } catch {}
      return null;
    };

    const scanFrame = async (timestamp: number) => {
      if (hasScannedRef.current) return;

      if (timestamp - lastScanTimestamp >= scanIntervalMs) {
        lastScanTimestamp = timestamp;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video && canvas && video.readyState >= video.HAVE_CURRENT_DATA) {
          const vWidth = video.videoWidth;
          const vHeight = video.videoHeight;

          if (vWidth > 0 && vHeight > 0) {
            // 1. Try Hardware-accelerated BarcodeDetector if browser supports it (instant on Chrome/Android)
            if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
              try {
                const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
                const barcodes = await detector.detect(video);
                if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                  handleFoundCode(barcodes[0].rawValue.trim());
                  return;
                }
              } catch {}
            }

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              // 2. High-Res Center Crop: 75% center region at 100% full uncompressed resolution
              // Maximizes module sharpness when aimed at another phone's screen
              const minEdge = Math.min(vWidth, vHeight);
              const cropSize = Math.floor(minEdge * 0.75);
              const cropX = Math.floor((vWidth - cropSize) / 2);
              const cropY = Math.floor((vHeight - cropSize) / 2);

              canvas.width = cropSize;
              canvas.height = cropSize;
              ctx.drawImage(video, cropX, cropY, cropSize, cropSize, 0, 0, cropSize, cropSize);

              let found = scanCanvas(ctx, cropSize, cropSize);

              // 3. Wide Frame fallback (scaled down if not found in center)
              if (!found) {
                const maxDim = 640;
                const scale = Math.min(1, maxDim / Math.max(vWidth, vHeight));
                const fullW = Math.floor(vWidth * scale);
                const fullH = Math.floor(vHeight * scale);

                canvas.width = fullW;
                canvas.height = fullH;
                ctx.drawImage(video, 0, 0, fullW, fullH);
                found = scanCanvas(ctx, fullW, fullH);
              }

              if (found) {
                handleFoundCode(found);
                return;
              }
            }
          }
        }
      }

      animFrameId.current = requestAnimationFrame(scanFrame);
    };

    animFrameId.current = requestAnimationFrame(scanFrame);
  }, [handleFoundCode]);

  // Start native camera
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    if (scanMode !== 'camera') {
      stopCamera();
      return;
    }

    let isMounted = true;
    setIsInitializing(true);
    setErrorMsg(null);
    hasScannedRef.current = false;

    const initCamera = async () => {
      try {
        stopCamera();

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('getUserMedia not supported in this browser environment');
        }

        // Always request standard environment facingMode unless user explicitly chose a camera
        let constraints: MediaStreamConstraints = {
          video: selectedCameraId
            ? { deviceId: { exact: selectedCameraId } }
            : { facingMode: { ideal: 'environment' } },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.setAttribute('webkit-playsinline', 'true');
          videoRef.current.muted = true;
          videoRef.current.defaultMuted = true;
          await videoRef.current.play();

          if (isMounted) {
            setIsInitializing(false);
            startScanningLoop();
          }
        }

        // Discover available cameras once for the flip button (WITHOUT restarting the stream)
        if (navigator.mediaDevices.enumerateDevices) {
          navigator.mediaDevices.enumerateDevices().then((devices) => {
            const videoInputs = devices.filter((d) => d.kind === 'videoinput');
            if (videoInputs.length > 1 && isMounted) {
              setAvailableCameras(videoInputs);
            }
          }).catch(() => {});
        }
      } catch (err: any) {
        console.warn('Native camera start error:', err);
        if (isMounted) {
          setIsInitializing(false);
          setScanMode('manual');
          setErrorMsg(
            'Камерата не може да бъде стартирана на това устройство. Можете да въведете кода или телефона от картата ръчно.'
          );
        }
      }
    };

    initCamera();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isOpen, scanMode, selectedCameraId, startScanningLoop, stopCamera]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCodeInput.trim();
    if (!clean) return;

    sounds.playStampSound();
    stopCamera();
    onScanSuccess(clean);
    onClose();
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const toggleCamera = () => {
    if (availableCameras.length <= 1) return;
    sounds.playClick();
    const currentIdx = availableCameras.findIndex((c) => c.deviceId === selectedCameraId);
    const nextIdx = (currentIdx + 1) % availableCameras.length;
    setSelectedCameraId(availableCameras[nextIdx].deviceId);
  };

  // Image File / Photo Snapshot Fallback Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imgData.data, img.width, img.height, {
            inversionAttempts: 'attemptBoth',
          });
          if (code && code.data && code.data.trim()) {
            handleFoundCode(code.data.trim());
          } else {
            alert('В избраната снимка не беше открит QR код. Опитайте отново или въведете кода ръчно.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md select-none touch-none animate-fade-in"
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
      {/* Hidden offscreen canvas for pixel extraction */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden file input for photo upload / snap fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        className="relative w-full max-w-[340px] sm:max-w-sm bg-panel border border-line rounded-2xl p-4 sm:p-5 shadow-2xl overflow-hidden flex flex-col pointer-events-auto"
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

        {/* 1. NATIVE CAMERA CONTAINER */}
        <div className={scanMode === 'camera' ? 'block' : 'hidden'}>
          <div className="relative">
            {isInitializing && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-panel/95 rounded-xl font-mono min-h-[260px]">
                <div className="w-8 h-8 border-2 border-acid border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs text-mute">Стартиране на задната камера...</p>
              </div>
            )}

            <div className="relative w-full max-w-[270px] sm:max-w-[300px] aspect-square mx-auto rounded-xl overflow-hidden border-2 border-acid/60 bg-black flex items-center justify-center shadow-lg">
              <video
                ref={videoRef}
                className="w-full h-full object-cover rounded-xl"
                playsInline
                autoPlay
                muted
              />

              {/* Instant Scan Success Confirmation Overlay */}
              {isScanSuccess && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-acid/95 text-ink rounded-xl font-mono animate-fade-in select-none px-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-ink text-acid flex items-center justify-center mb-2 shadow-2xl animate-bounce border-2 border-ink">
                    <span className="text-3xl font-black">✓</span>
                  </div>
                  <p className="text-lg font-black tracking-wider uppercase">УСПЕШНО СКАНИРАНО!</p>
                  {scannedCustomerName && (
                    <p className="text-sm font-black text-ink mt-0.5 tracking-tight">
                      {scannedCustomerName}
                    </p>
                  )}
                  <p className="text-xs font-bold text-ink/80 mt-1 uppercase tracking-wide">
                    ДОБАВЯ СЕ ПЕЧАТ...
                  </p>
                </div>
              )}

              {/* Laser Scan Guide Corners & Scanline */}
              {!isInitializing && !isScanSuccess && (
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
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-mute hover:text-bone flex items-center gap-1"
                title="Качи или снимай с камера"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Качи снимка</span>
              </button>

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
                ВЪВЕДИ ИМЕ ИЛИ КОД
              </h3>
              <p className="text-xs text-mute mt-1">
                Въведи името на клиента или кода под QR кода:
              </p>
            </div>

            <div>
              <label className="label-nv">
                Име на Клиента или Код от Карта:
              </label>
              <input
                type="text"
                required
                autoFocus
                value={manualCodeInput}
                onChange={(e) => setManualCodeInput(e.target.value)}
                placeholder="напр. Марин Илиев или #BO9Z5Z"
                className="field rounded-xl text-center text-lg font-bold font-mono tracking-wider text-acid placeholder:text-xs placeholder:tracking-normal placeholder:font-sans"
              />
            </div>

            <button
              type="submit"
              className="btn btn-acid w-full rounded-xl !py-3.5 text-xs font-bold shadow-acid-hard cursor-pointer"
            >
              <span>ДОБАВИ ПЕЧАТ</span>
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
