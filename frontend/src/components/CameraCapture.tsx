import { Camera, RotateCcw, SwitchCamera } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type CameraCaptureProps = {
  onCapture: (blob: Blob, dataUrl: string) => void;
  facingMode?: 'user' | 'environment';
  showSwitch?: boolean;
};

export default function CameraCapture({
  onCapture,
  facingMode: initialFacing = 'user',
  showSwitch = true,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(initialFacing);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setStarting(true);
    setError(null);

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Tarayıcı kamerayı desteklemiyor.');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => undefined);
        }
        setStarting(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Kameraya erişilemedi.';
        setError(msg);
        setStarting(false);
      }
    }

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facingMode, preview]);

  const capture = () => {
    const v = videoRef.current;
    if (!v) return;
    const w = v.videoWidth;
    const h = v.videoHeight;
    if (!w || !h) return;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setPreview(dataUrl);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob, dataUrl);
      },
      'image/jpeg',
      0.9,
    );
  };

  const retake = () => {
    setPreview(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative bg-black rounded-xl overflow-hidden aspect-[4/3] w-full flex items-center justify-center">
        {error ? (
          <div className="text-white p-4 text-center">
            <p className="font-label-md mb-2">Kamera açılamadı</p>
            <p className="font-body-sm text-sm opacity-80">{error}</p>
          </div>
        ) : preview ? (
          <img alt="Önizleme" src={preview} className="w-full h-full object-cover" />
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />
            {starting && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {showSwitch && !error && (
              <button
                type="button"
                onClick={() => setFacingMode((f) => (f === 'user' ? 'environment' : 'user'))}
                className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm border border-white/20 hover:bg-black/70 transition-colors"
                title="Kamerayı değiştir"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>
            )}
          </>
        )}
      </div>
      <div className="flex gap-2">
        {preview ? (
          <button
            type="button"
            onClick={retake}
            className="flex-1 bg-surface-container-low text-on-surface font-label-md text-label-md py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-surface-container-high transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Tekrar Çek
          </button>
        ) : (
          <button
            type="button"
            onClick={capture}
            disabled={!!error || starting}
            className="flex-1 bg-primary text-on-primary font-label-md text-label-md py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-surface-tint transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Camera className="w-4 h-4" />
            Fotoğraf Çek
          </button>
        )}
      </div>
    </div>
  );
}
