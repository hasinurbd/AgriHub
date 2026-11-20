import React, { useRef, useState } from 'react';
import { ImagePlus, Trash2, UploadCloud, Link2 } from 'lucide-react';

interface ProductImageDropzoneProps {
  value: string;
  onChange: (nextUrl: string) => void;
  label?: string;
}

function resizeProductImage(file: File, maxWidth = 720, maxHeight = 540): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported image format.'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function ProductImageDropzone({
  value,
  onChange,
  label = 'Produce Batch Image (Drag & Drop or Browse)'
}: ProductImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please drop or select a valid image file (PNG, JPG, WebP).');
      return;
    }
    setErrorMsg(null);
    setProcessing(true);
    try {
      const dataUrl = await resizeProductImage(file);
      onChange(dataUrl);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to process selected image.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-slate-700 dark:text-slate-300 font-semibold">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
        >
          <Link2 className="w-3 h-3" />
          <span>{showUrlInput ? 'Hide URL input' : 'Or paste image URL'}</span>
        </button>
      </div>

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(false);
        }}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`relative rounded-xl border-2 border-dashed p-3.5 transition cursor-pointer ${
          dragging
            ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/50'
            : 'border-slate-300 dark:border-emerald-900/60 bg-slate-50 dark:bg-slate-800/60 hover:border-emerald-500'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {value ? (
          <div className="flex items-center gap-3.5">
            <div className="w-20 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
              <img
                src={value}
                alt="Produce batch preview"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                {processing ? 'Optimizing image...' : 'Image ready'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Drag a new image here or click to replace
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              aria-label="Remove product image"
              className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="py-3 flex flex-col items-center justify-center text-center gap-1.5">
            {dragging ? (
              <UploadCloud className="w-6 h-6 text-emerald-600 animate-bounce" />
            ) : (
              <ImagePlus className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
            )}
            <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
              {processing
                ? 'Compressing image...'
                : dragging
                ? 'Drop produce image here'
                : 'Drag & drop produce photo here, or click to browse'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Supports JPG, PNG, WebP · Auto-resized for fast offline storage
            </div>
          </div>
        )}
      </div>

      {showUrlInput && (
        <input
          type="url"
          value={value.startsWith('data:') ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/harvest-photo.jpg"
          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
        />
      )}

      {errorMsg && (
        <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">{errorMsg}</p>
      )}
    </div>
  );
}
