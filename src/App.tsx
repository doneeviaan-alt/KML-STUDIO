import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileSpreadsheet, 
  Settings2, 
  Layers, 
  ChevronRight, 
  Database,
  RefreshCw, 
  Compass, 
  CheckCircle2, 
  AlertCircle,
  FileCheck2,
  Trash2,
  Globe,
  GitBranch,
  Info,
  MapPin,
  Ruler,
  Home,
  HelpCircle
} from 'lucide-react';

import { ParseResult } from './utils/kmlParser';
import FileSelector from './components/FileSelector';
import { 
  exportToExcel,
  getUniqueSheetName,
  calculatePlacemarkLength,
  isHomepassPlacemark,
  countHomepassInPolygon,
  calculateLastSegmentLength,
  getHomepassValue,
  calculateDistance,
  createPlacemarkRows
} from './utils/excelExporter';

export default function App() {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [tolerance, setTolerance] = useState<number>(1.0);

  // Generate Volume Sheet statistics
  const volumeData = useMemo(() => {
    if (!parseResult) return null;

    // First construct sheetNameMap exactly matching how exportToExcel works
    const folderGroups: Record<string, typeof parseResult.placemarks> = {};
    for (const pm of parseResult.placemarks) {
      const fKey = pm.folderPath ? pm.folderPath.trim() : 'Utama';
      if (!folderGroups[fKey]) {
        folderGroups[fKey] = [];
      }
      folderGroups[fKey].push(pm);
    }

    const folderKeys = Object.keys(folderGroups);
    const sheetNameMap: Record<string, string> = {};
    const usedSheetNames = new Set<string>();
    usedSheetNames.add('volume');

    const cleanFileName = parseResult.fileName
      ? 'CHEKED_' + parseResult.fileName.replace(/\.(kml|kmz)$/i, '')
      : 'CHEKED_kml_data';

    for (const folderName of folderKeys) {
      if (folderName === 'Utama' && folderKeys.length === 1) {
        const baseFile = cleanFileName;
        sheetNameMap[folderName] = getUniqueSheetName(baseFile, usedSheetNames);
      } else {
        sheetNameMap[folderName] = getUniqueSheetName(folderName, usedSheetNames);
      }
    }

    // Process statistics
    const folderStats: Record<string, {
      totalCount: number;
      totalLength: number;
      folderName: string;
    }> = {};

    for (const pm of parseResult.placemarks) {
      const origFolder = pm.folderPath ? pm.folderPath.trim() : 'Utama';
      const folderLabel = sheetNameMap[origFolder] || origFolder;
      
      if (!folderStats[folderLabel]) {
        folderStats[folderLabel] = {
          totalCount: 0,
          totalLength: 0,
          folderName: folderLabel
        };
      }
      
      const geom = pm.geometryType;
      const len = calculatePlacemarkLength(pm.coordinates, pm.geometryType, pm.name);
      
      folderStats[folderLabel].totalCount++;
      if (geom === 'LineString' || geom === 'Polygon') {
        folderStats[folderLabel].totalLength += len;
      }
    }

    const rows = Object.values(folderStats).map((stat, i) => ({
      no: i + 1,
      folderLabel: stat.folderName,
      totalCount: stat.totalCount,
      totalLength: stat.totalLength
    }));

    // Calculate totals for summary line
    const totalObjects = rows.reduce((acc, curr) => acc + curr.totalCount, 0);
    const totalLength = rows.reduce((acc, curr) => acc + curr.totalLength, 0);

    // Filter and count FAT polygons & Homepass statistics
    const fatPolygons = parseResult.placemarks
      .filter(pm => pm.geometryType === 'Polygon' && pm.name.toUpperCase().startsWith('FAT'))
      .map(pm => {
        const hpCount = countHomepassInPolygon(pm.coordinates, parseResult.placemarks, pm.name);
        return {
          id: pm.id,
          name: pm.name,
          folder: pm.folderPath || 'Utama',
          homepassCount: hpCount,
          coordinateCount: pm.coordinates.length
        };
      });

    // Count homepasses in the entire file
    const totalHomepasses = parseResult.placemarks.filter(pm => isHomepassPlacemark(pm)).length;

    // Filter only those homepasses that have the circle icon
    const circleHomepasses = parseResult.placemarks.filter(pm => {
      if (!isHomepassPlacemark(pm)) return false;
      const iconLower = pm.styleIcon ? pm.styleIcon.toLowerCase() : '';
      return iconLower.includes('placemark_circle') || 
             iconLower.includes('placemark_circle.png') ||
             iconLower.includes('/b.png') ||
             iconLower === 'b.png' ||
             iconLower.endsWith('b.png');
    }).length;

    return {
      rows,
      totalObjects,
      totalLength,
      fatPolygons,
      totalHomepasses,
      circleHomepasses
    };
  }, [parseResult]);

  // Pengecekan jumlah dan koneksi placemark_circle.png dengan linestring (dropwire)
  const dropwireCheck = useMemo(() => {
    if (!parseResult) return null;

    const circles = parseResult.placemarks.filter(pm => {
      const isPoint = pm.geometryType === 'Point' || pm.coordinates.length === 1;
      if (!isPoint || pm.coordinates.length === 0) return false;
      const iconLower = pm.styleIcon ? pm.styleIcon.toLowerCase() : '';
      return iconLower.includes('placemark_circle') || 
             iconLower.includes('placemark_circle.png') ||
             iconLower.includes('/b.png') ||
             iconLower === 'b.png' ||
             iconLower.endsWith('b.png');
    });

    const dropwires = parseResult.placemarks.filter(pm => {
      if (pm.geometryType !== 'LineString' || pm.coordinates.length < 2) return false;
      const nameUpper = pm.name ? pm.name.toUpperCase() : '';
      const folderUpper = pm.folderPath ? pm.folderPath.toUpperCase() : '';
      return nameUpper.includes('DROPWIRE') || folderUpper.includes('DROPWIRE');
    });

    const isCountMatch = circles.length === dropwires.length;

    const circleDetails = circles.map((circle) => {
      const coord = circle.coordinates[0];
      let isConnected = false;
      let minDistance = Infinity;
      let nearestDropwire : any = null;
      let endpointType: 'start' | 'end' | null = null;

      for (const dw of dropwires) {
        if (dw.coordinates.length < 2) continue;
        const startPt = dw.coordinates[0];
        const endPt = dw.coordinates[dw.coordinates.length - 1];

        const distToStart = calculateDistance(coord, startPt);
        const distToEnd = calculateDistance(coord, endPt);

        if (distToStart < minDistance) {
          minDistance = distToStart;
          nearestDropwire = dw;
          endpointType = 'start';
        }
        if (distToEnd < minDistance) {
          minDistance = distToEnd;
          nearestDropwire = dw;
          endpointType = 'end';
        }
      }

      if (minDistance <= tolerance) {
        isConnected = true;
      }

      return {
        circle,
        isConnected,
        minDistance: minDistance === Infinity ? null : minDistance,
        nearestDropwire,
        endpointType
      };
    });

    const unconnectedCircles = circleDetails.filter(d => !d.isConnected);
    const connectedCircles = circleDetails.filter(d => d.isConnected);
    const isAllConnected = unconnectedCircles.length === 0;

    return {
      circlesCount: circles.length,
      dropwiresCount: dropwires.length,
      isCountMatch,
      circleDetails,
      unconnectedCircles,
      connectedCircles,
      isAllConnected,
      isValid: isCountMatch && isAllConnected
    };
  }, [parseResult, tolerance]);

  // Filter long last segments (> 35 meters) and find their nearest homepass id
  const longLastSegments = useMemo(() => {
    if (!parseResult) return [];

    const result: Array<{
      id: string;
      name: string;
      folderPath: string;
      lastSegmentLength: number;
      totalLength: number;
      nearestHomepass: {
        id: string;
        name: string;
        homepassId: string;
        distance: number;
      } | null;
    }> = [];

    const linePlacemarks = parseResult.placemarks.filter(
      (pm) => pm.geometryType === 'LineString' && pm.coordinates.length >= 2
    );

    const homepassPlacemarks = parseResult.placemarks.filter((pm) => isHomepassPlacemark(pm));

    for (const pm of linePlacemarks) {
      const lastSegLen = calculateLastSegmentLength(pm.coordinates);

      if (lastSegLen > 35) {
        let nearestHpPm = null;
        let minDistance = Infinity;

        if (pm.coordinates.length > 0) {
          const ptA = pm.coordinates[0];
          const ptB = pm.coordinates[pm.coordinates.length - 1];

          for (const hp of homepassPlacemarks) {
            if (hp.id === pm.id) continue;

            if (hp.coordinates.length > 0) {
              const hpCoord = hp.coordinates[0];
              const distA = calculateDistance(ptA, hpCoord);
              const distB = calculateDistance(ptB, hpCoord);
              const d = Math.min(distA, distB);

              if (d < minDistance) {
                minDistance = d;
                nearestHpPm = hp;
              }
            }
          }
        }

        result.push({
          id: pm.id,
          name: pm.name,
          folderPath: pm.folderPath || 'Utama',
          lastSegmentLength: lastSegLen,
          totalLength: calculatePlacemarkLength(pm.coordinates, pm.geometryType, pm.name),
          nearestHomepass: nearestHpPm
            ? {
                id: nearestHpPm.id,
                name: nearestHpPm.name,
                homepassId: getHomepassValue(nearestHpPm),
                distance: minDistance,
              }
            : null,
        });
      }
    }

    return result;
  }, [parseResult]);

  // Generate Dropwire Sheets converted tables for web preview
  const dropwireSheets = useMemo(() => {
    if (!parseResult) return [];

    // Group placemarks by folder, just like exportToExcel
    const folderGroups: Record<string, typeof parseResult.placemarks> = {};
    for (const pm of parseResult.placemarks) {
      const fKey = pm.folderPath ? pm.folderPath.trim() : 'Utama';
      if (!folderGroups[fKey]) {
        folderGroups[fKey] = [];
      }
      folderGroups[fKey].push(pm);
    }

    const folderKeys = Object.keys(folderGroups);
    const sheetNameMap: Record<string, string> = {};
    const usedSheetNames = new Set<string>();
    usedSheetNames.add('volume');

    const cleanFileName = parseResult.fileName
      ? 'CHEKED_' + parseResult.fileName.replace(/\.(kml|kmz)$/i, '')
      : 'CHEKED_kml_data';

    for (const folderName of folderKeys) {
      if (folderName === 'Utama' && folderKeys.length === 1) {
        sheetNameMap[folderName] = getUniqueSheetName(cleanFileName, usedSheetNames);
      } else {
        sheetNameMap[folderName] = getUniqueSheetName(folderName, usedSheetNames);
      }
    }

    const sheetsList: Array<{
      sheetName: string;
      rows: Record<string, any>[];
    }> = [];

    const config = {
      includeDms: true,
      includeFlatCoords: false,
      exportVertexSheet: true,
      customColumns: parseResult.extendedKeys
    };

    for (const folderName of folderKeys) {
      const pmList = folderGroups[folderName];
      const isDropwireOnly = pmList.length > 0 && pmList.some(pm => pm.name && pm.name.toUpperCase().includes('DROPWIRE'));
      
      if (isDropwireOnly) {
        const folderRows = createPlacemarkRows(pmList, config, sheetNameMap, parseResult.placemarks);
        sheetsList.push({
          sheetName: sheetNameMap[folderName] || folderName,
          rows: folderRows
        });
      }
    }

    return sheetsList;
  }, [parseResult]);

  const handleFileParsed = (result: ParseResult) => {
    setIsParsing(false);
    setParsingError(null);
    setParseResult(result);
  };

  const handleParsingStart = () => {
    setIsParsing(true);
    setParsingError(null);
  };

  const handleParsingError = (err: string) => {
    setIsParsing(false);
    setParsingError(err);
  };

  const handleReset = () => {
    setParseResult(null);
    setParsingError(null);
  };

  const handleExportDirect = () => {
    if (!parseResult) return;
    try {
      const config = {
        includeDms: true,
        includeFlatCoords: false,
        exportVertexSheet: true,
        customColumns: parseResult.extendedKeys,
        tolerance: tolerance
      };
      const cleanName = parseResult.fileName
        ? 'CHEKED_' + parseResult.fileName.replace(/\.(kml|kmz)$/i, '')
        : 'CHEKED_kml_data';
      
      exportToExcel(parseResult.placemarks, config, cleanName);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (e) {
      console.error(e);
      alert('Gagal mengekspor data ke Excel.');
    }
  };

  // Human readable format for file sizes
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 selection:bg-orange-500/10 selection:text-orange-500 transition-colors">
      {/* Decorative Glow Elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none animate-pulse-slow" />
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-orange-500/5 dark:bg-orange-500/3 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" style={{ animationDelay: '2s' }} />

      {/* Persistent Outer Clean Floating Utility Rails are strictly forbidden as per Architectural Honesty, keep margin clean and page elements centered */}
      
      {/* Main Container */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative flex flex-col">
        
        {/* elegant display typography Header */}
        <header className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-900">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-slate-950 shadow-md transform hover:rotate-12 transition">
                <Compass className="w-5 h-5 font-bold stroke-[2.2]" />
              </div>
              <h1 className="font-sans font-extrabold text-2xl tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-orange-750 dark:from-white dark:via-slate-200 dark:to-orange-400 bg-clip-text text-transparent">
                KML STUDIO TRISNO
              </h1>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 font-medium max-w-2xl">
              Tools yang mengubah Pengguna menjadi drafter profesional
            </p>
          </div>
          
          {parseResult && (
            <div className="flex flex-wrap items-center gap-3 self-end md:self-center">
              {exportSuccess ? (
                <div className="px-5 py-2.5 bg-emerald-500 text-slate-950 font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-md animate-bounce">
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  Ekspor Berhasil!
                </div>
              ) : (
                <button
                  onClick={handleExportDirect}
                  className="px-5 py-2.5 bg-gradient-to-r from-orange-400 to-amber-500 hover:from-orange-500 hover:to-amber-600 text-slate-950 text-xs font-extrabold rounded-xl transition flex items-center gap-2 shadow-md hover:scale-[1.02] active:scale-95"
                >
                  <FileSpreadsheet className="w-4 h-4 stroke-[2.2]" />
                  Unduh File Excel
                </button>
              )}

              <button
                onClick={handleReset}
                className="px-4 py-2.5 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Bersihkan & Ganti File
              </button>
            </div>
          )}
        </header>

        {/* View Transitioning wrapper */}
        <AnimatePresence mode="wait">
          {!parseResult ? (
            <motion.div
              key="uploader-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="space-y-8"
              id="uploader-section"
            >
              {/* Core interaction panel */}
              {isParsing ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-16 flex flex-col items-center justify-center text-center shadow-lg">
                  <div className="relative w-16 h-16 mb-4">
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-slate-800" />
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
                  </div>
                  <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">Sedang Memproses Geodata...</h3>
                  <p className="text-sm text-slate-500 mt-2 max-w-xs">
                    Mengekstrak penanda spasial, ExtendedData atribut data skema, dan merelasikan simpul pemetaan koordinat KML/KMZ secara lokal di browser Anda.
                  </p>
                </div>
              ) : (
                <FileSelector
                  onFileParsed={handleFileParsed}
                  onParsingStart={handleParsingStart}
                  onParsingError={handleParsingError}
                />
              )}

              {/* Informational Guidelines Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-6 rounded-2xl shadow-sm space-y-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">Pemetaan Koordinat Otomatis</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Mengekstrak tipe geometri Point, LineString (rute), dan Polygon (wilayah) secara presisi ke dalam baris grid spreadsheet, lengkap dengan perhitungan titik centroid otomatis.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-6 rounded-2xl shadow-sm space-y-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">Konversi DMS & Skema Dinamis</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Mampu mengkonversi koordinat desimal langsung ke format Degrees Minutes Seconds (DMS) standar navigasi lapangan dan mengekstrak semua data tabel ExtendedData tak terduga.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-6 rounded-2xl shadow-sm space-y-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">Ekspor Multi-Sheet Rapi</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Menghasilkan file Excel berukuran optimal dengan dua tab utama: Ringkasan Objek Terpetakan, dan Rincian Sambungan Koordinat Simpul per Placemark KML secara terstruktur.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="dashboard-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35 }}
              className="space-y-6"
              id="dashboard-section"
            >

              {/* PENGECEKAN KESELARASAN DROPWIRE DAN PLACEMARK CIRCLE */}
              {dropwireCheck && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden" id="validation-dropwire-card">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-5 h-5 text-orange-500" />
                      <div>
                        <h2 className="font-bold text-base text-slate-800 dark:text-slate-100 uppercase">PENGECEKAN KESELARASAN DROPWIRE & KONEKSI</h2>
                        <p className="text-xs text-slate-400">Verifikasi jumlah dan Koneksi antara Homepass dengan Dropwire</p>
                      </div>
                    </div>
                    
                    {/* Interactive Snapping Tolerance Slider */}
                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950/40 px-3 py-1.5 rounded-xl border border-slate-150 dark:border-slate-850 self-start md:self-center">
                      <Ruler className="w-4 h-4 text-slate-400 font-semibold" />
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-350 whitespace-nowrap">
                        Toleransi Jarak: <span className="font-mono font-bold text-orange-600 dark:text-orange-400">{tolerance.toFixed(1)} m</span>
                      </label>
                      <input 
                        type="range" 
                        min="0.1" 
                        max="5.0" 
                        step="0.1" 
                        value={tolerance} 
                        onChange={(e) => setTolerance(parseFloat(e.target.value))}
                        className="w-24 accent-orange-500 h-1 rounded-lg bg-slate-200 dark:bg-slate-700 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Big Status Banner */}
                    <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      dropwireCheck.isValid 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-400'
                        : 'bg-amber-500/10 border-amber-500/25 text-amber-800 dark:text-amber-400'
                    }`}>
                      <div className="flex items-start gap-3">
                        {dropwireCheck.isValid ? (
                          <CheckCircle2 className="w-6 h-6 stroke-[2.2] text-emerald-500 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-6 h-6 stroke-[2.2] text-amber-500 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <h3 className="font-extrabold text-sm uppercase tracking-wider">
                            {dropwireCheck.isValid ? 'Hasil Verifikasi: VALID & SESUAI' : 'Hasil Verifikasi: ADA KETIDAKSESUAIAN'}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-300 mt-1 leading-relaxed">
                            {dropwireCheck.isValid 
                              ? 'Semua placemark_circle.png memiliki linestring (dropwire) yang terhubung tepat pada salah satu ujungnya, dan jumlah kedua objek sama.'
                              : `${!dropwireCheck.isCountMatch ? `Jumlah Selisih (${dropwireCheck.circlesCount} Homepass & ${dropwireCheck.dropwiresCount} Dropwire). ` : ''}${!dropwireCheck.isAllConnected ? `Ditemukan ${dropwireCheck.unconnectedCircles.length} Homepass tanpa ujung dropwire.` : ''}`}
                          </p>
                        </div>
                      </div>
                      
                      <div className="shrink-0 font-mono text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-white/70 dark:bg-slate-900/60 shadow-xs border border-current text-center">
                        {dropwireCheck.isValid ? 'GEODATA VALID' : 'PERIKSA DIAGNOSTIK'}
                      </div>
                    </div>

                    {/* Numeric breakdown metric items */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-slate-50/70 dark:bg-slate-950/25 border border-slate-100 dark:border-slate-850 p-4 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Placemark Circle</p>
                          <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">{dropwireCheck.circlesCount}</p>
                        </div>
                        <span className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-lg">
                          ◯
                        </span>
                      </div>

                      <div className="bg-slate-50/70 dark:bg-slate-950/25 border border-slate-100 dark:border-slate-850 p-4 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Dropwire Linestrings</p>
                          <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">{dropwireCheck.dropwiresCount}</p>
                        </div>
                        <span className="w-9 h-9 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold text-base">
                          ╱
                        </span>
                      </div>

                      <div className="bg-slate-50/70 dark:bg-slate-950/25 border border-slate-100 dark:border-slate-850 p-4 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Kesesuaian Jumlah</p>
                          <p className={`text-base font-bold mt-2 ${dropwireCheck.isCountMatch ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {dropwireCheck.isCountMatch ? 'Sama (Pas)' : `Selisih ${Math.abs(dropwireCheck.circlesCount - dropwireCheck.dropwiresCount)}`}
                          </p>
                        </div>
                        <span className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
                          dropwireCheck.isCountMatch ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                        }`}>
                          {dropwireCheck.isCountMatch ? '✓' : '✗'}
                        </span>
                      </div>
                    </div>

                    {/* Unconnected item details */}
                    {!dropwireCheck.isAllConnected && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                          <h4 className="font-extrabold text-xs text-rose-600 dark:text-rose-450 uppercase tracking-wider">
                            DAFTAR HOMEPASS YANG TIDAK TERKONEKSI:
                          </h4>
                        </div>
                        
                        <div className="overflow-x-auto max-h-72 overflow-y-auto border border-slate-105 dark:border-slate-850 rounded-xl">
                          <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 shadow-xs border-b border-slate-200 dark:border-slate-800">
                              <tr className="bg-slate-50 dark:bg-slate-950/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                <th className="px-4 py-3 text-center w-12">No</th>
                                <th className="px-4 py-3">Homepass Id</th>
                                <th className="px-4 py-3">Koordinat Circle</th>
                                <th className="px-4 py-3 text-right">Jarak Ujung Terdekat</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-xs">
                              {dropwireCheck.unconnectedCircles.map((detail, rIdx) => {
                                const circle = detail.circle;
                                const coord = circle.coordinates[0];
                                const hpId = getHomepassValue(circle);
                                const hpDisplayName = (hpId && hpId !== '-') ? hpId : (circle.name || `Placemark #${rIdx + 1}`);
                                return (
                                  <tr key={circle.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition">
                                    <td className="px-4 py-3 text-center text-slate-400 font-mono">{rIdx + 1}</td>
                                    <td className="px-4 py-3">
                                      <span className="px-2.5 py-1 inline-block bg-slate-800 dark:bg-slate-950/80 rounded-md font-semibold text-white font-mono text-[11px] tracking-wide shadow-sm border border-slate-700/50">
                                        {hpDisplayName}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-400 font-mono whitespace-nowrap">
                                      {coord ? `${coord.lat.toFixed(6)}, ${coord.lng.toFixed(6)}` : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-500">
                                      {detail.minDistance !== null ? `${detail.minDistance.toFixed(2)} m` : 'N/A'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Connected item counts summary block */}
                    {dropwireCheck.connectedCircles.length > 0 && (
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 px-4 py-2.5 rounded-lg flex items-center gap-2">
                        <span className="text-emerald-500 font-semibold">✓</span>
                        <span>
                          Pengecekan Berhasil memverifikasi <strong>{dropwireCheck.connectedCircles.length} dari {dropwireCheck.circlesCount}</strong> Homepass terhubung secara presisi ke setiap ujung dropwire (jarak ≤ {tolerance} m).
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Volume Sheet Table Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
                    <div>
                      <h2 className="font-bold text-base text-slate-800 dark:text-slate-100">VOLUME OBJEK</h2>
                      <p className="text-xs text-slate-400">Volume ini dihitung secara dinamis bergantung Folder dan Objek yang berada didalamnya</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full">
                    Volume Tab
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-850 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <th className="px-6 py-4 w-16 text-center">No</th>
                        <th className="px-6 py-4">Nama Sheet Folder</th>
                        <th className="px-6 py-4 text-center">Total Objek</th>
                        <th className="px-6 py-4 text-right">Total Panjang (m)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-sm">
                      {volumeData?.rows.map((row) => (
                        <tr key={row.no} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition duration-150">
                          <td className="px-6 py-4 text-center font-mono text-xs text-slate-400">{row.no}</td>
                          <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">{row.folderLabel}</td>
                          <td className="px-6 py-4 text-center font-medium">{row.totalCount}</td>
                          <td className="px-6 py-4 text-right font-mono text-xs text-slate-500 dark:text-slate-400">
                            {row.totalLength > 0 ? Number(row.totalLength.toFixed(1)).toLocaleString('id-ID') : '-'}
                          </td>
                        </tr>
                      ))}

                    </tbody>
                  </table>
                </div>
              </div>

              {/* FAT & Homepass Detail Summary */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2">
                     <Home className="w-5 h-5 text-rose-500" />
                     <div>
                       <h2 className="font-bold text-base text-slate-800 dark:text-slate-100">HOMEPASS YANG TERCOVER FAT</h2>
                       <p className="text-xs text-slate-400">
                         Mendeteksi secara spesifik titik Homepass yang terkoneksi ke FAT
                       </p>
                     </div>
                  </div>
                </div>
                <div className="p-6">
                  {volumeData && volumeData.fatPolygons.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {volumeData.fatPolygons.map((poly) => (
                        <div key={poly.id} className="relative group border border-slate-100 dark:border-slate-850 bg-slate-50/40 dark:bg-slate-950/20 p-5 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 transition">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5_no">
                                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse inline-block" />
                                {poly.name}
                              </h3>
                              <p className="text-[11px] font-medium text-slate-400 truncate max-w-[180px]">
                                Folder: {poly.folder}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-2xl font-black text-rose-500">{poly.homepassCount}</span>
                              <span className="text-[10px] block font-mono text-slate-400 uppercase tracking-widest">Homepass</span>
                            </div>
                          </div>
                          
                          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                            <span>Batas Polygon: {poly.coordinateCount} titik</span>
                            <span className="text-emerald-500 bg-emerald-500/15 dark:bg-emerald-500/5 px-2 py-0.5 rounded-full">Tervalidasi</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center bg-slate-50/50 dark:bg-slate-950/10 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                      <HelpCircle className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Tidak Ada Polygon FAT Terdeteksi</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Aplikasi tidak mendeteksi adanya objek bertipe Polygon dengan nama berawalan "FAT" di dalam berkas ini.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Dropwire Conversion Sheet Results */}
              {dropwireSheets.map((sheet, sIdx) => {
                if (sheet.rows.length === 0) return null;
                const columns = Object.keys(sheet.rows[0]).filter((col) => col !== 'Nama Objek' && !/^Segmen \d+$/i.test(col));

                // Filter rows based on: Total Panjang > 150 meters OR Segmen Terakhir > 35 meters
                const filteredRows = sheet.rows.filter((row) => {
                  const totalPanjangStr = String(row['Total Panjang'] || '');
                  const totalPanjangMatch = totalPanjangStr.match(/([\d.]+)/);
                  const totalPanjangVal = totalPanjangMatch ? parseFloat(totalPanjangMatch[1]) : 0;

                  const segmenTerakhirStr = String(row['Segmen Terakhir'] || '');
                  const segmenTerakhirMatch = segmenTerakhirStr.match(/([\d.]+)/);
                  const segmenTerakhirVal = segmenTerakhirMatch ? parseFloat(segmenTerakhirMatch[1]) : 0;

                  return totalPanjangVal > 150 || segmenTerakhirVal > 35;
                });

                return (
                  <div key={sheet.sheetName + sIdx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                       <div className="flex items-center gap-2">
                         <FileCheck2 className="w-5 h-5 text-emerald-500" />
                         <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="font-bold text-base text-slate-800 dark:text-slate-100 uppercase">{sheet.sheetName}</h2>



                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            Menampilkan data dropwire yang diluar ketentuan
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/45 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span>Menampilkan {filteredRows.length} dari {sheet.rows.length} baris</span>
                      </div>
                    </div>
                    <div className="p-6">
                      {filteredRows.length > 0 ? (
                        <div className="overflow-x-auto max-h-[500px] overflow-y-auto border border-slate-100 dark:border-slate-850 rounded-xl">
                          <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 shadow-sm border-b border-slate-200 dark:border-slate-800">
                              <tr className="bg-slate-50 dark:bg-slate-950/40 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                {columns.map((col) => (
                                  <th key={col} className="px-4 py-3.5 whitespace-nowrap">
                                    {col === 'Koordinat Ujung' ? 'KOORDINAT' : (col === 'HP_ID' ? 'HOMEPASS' : (col === 'LastPole' || col === 'Last Pole' ? 'LASTPOLE' : col))}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-sm">
                              {filteredRows.map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition duration-150">
                                  {columns.map((col) => {
                                    const val = row[col];
                                    const isCoordOrId = col === 'Koordinat Ujung' || col === 'HP_ID' || col === 'Nama Objek';
                                    return (
                                      <td 
                                        key={col} 
                                        className={`px-4 py-3 whitespace-nowrap font-mono text-xs ${
                                          isCoordOrId 
                                            ? 'font-bold text-slate-900 dark:text-indigo-400' 
                                            : 'text-slate-500 dark:text-slate-400'
                                        }`}
                                      >
                                        {val !== undefined && val !== null ? String(val) : '-'}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-12 text-center bg-slate-50/50 dark:bg-slate-950/10 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                          <HelpCircle className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">DROPWIRE AMAN</p>
                          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                            Tidak ditemukan hasil dropwire dengan Panjang lebih 150m atau lastpole lebih dari 35m
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}




            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Design Policy */}
      <footer className="mt-16 border-t border-slate-200 dark:border-slate-900 py-6 text-center text-xs text-slate-400 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-indigo-500" />
            <span>TRISNO DJOYO</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Indonesia Geoportal Compliant</span>
            <span>•</span>
            <span className="text-slate-500">v1.2.0 (2026)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
