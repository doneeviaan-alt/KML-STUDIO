import React, { useState } from 'react';
import { UploadCloud, FileJson, AlertTriangle } from 'lucide-react';
import { ParseResult } from '../utils/kmlParser';

interface FileSelectorProps {
  onFileParsed: (result: ParseResult) => void;
  onParsingStart: () => void;
  onParsingError: (err: string) => void;
}

export default function FileSelector({ onFileParsed, onParsingStart, onParsingError }: FileSelectorProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const processFile = async (file: File) => {
    onParsingStart();
    setErrorLocal(null);

    // Dynamic import to prevent bundler dependency order warnings
    try {
      const { parseKMLorKMZ } = await import('../utils/kmlParser');
      const parsed = await parseKMLorKMZ(file);
      onFileParsed(parsed);
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || 'Gagal mengurai file KML/KMZ.';
      setErrorLocal(msg);
      onParsingError(msg);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await processFile(file);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Drag & Drop Main Box */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center transition-all ${
          isDragActive
            ? 'border-emerald-500 bg-emerald-50/10 dark:bg-emerald-950/10 scale-[0.99]'
            : 'border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 bg-white dark:bg-slate-900/40'
        } shadow-lg`}
      >
        <input
          type="file"
          id="kml-file-input"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          accept=".kml,.kmz"
          onChange={handleFileInput}
        />

        <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-slate-800/80 flex items-center justify-center text-orange-500 dark:text-orange-400 mb-4 shadow-sm border border-orange-100 dark:border-slate-700">
          <UploadCloud className="w-8 h-8 animate-bounce" style={{ animationDuration: '3s' }} />
        </div>

        <h3 className="font-sans font-bold text-lg text-slate-850 dark:text-slate-100 leading-tight">
          Unggah File KML atau KMZ Anda
        </h3>
        <p className="text-sm text-slate-500 mt-2 max-w-sm">
          Seret & taruh file <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-orange-600">.kml</span> atau <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-orange-600">.kmz</span> di sini, atau klik untuk menelusuri komputer Anda.
        </p>

        <div className="mt-5 flex gap-4 text-xs font-medium text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
            Maks 50MB
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
            Aman & Privat (Diproses lokal)
          </span>
        </div>
      </div>

      {/* Local Error Alert */}
      {errorLocal && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl flex items-start gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Kesalahan Pemrosesan:</span>
            <p className="mt-1 text-xs">{errorLocal}</p>
          </div>
        </div>
      )}
    </div>
  );
}
