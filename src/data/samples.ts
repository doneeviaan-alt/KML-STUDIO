import { KMLPlacemark, ParseResult } from '../utils/kmlParser';

// Let's craft elegant sample KML datasets to allow users to instantly try the tool

export const SAMPLE_BANGUNAN_JAKARTA: ParseResult = {
  fileName: 'Menara_Telekomunikasi_Jakarta_Sample_Data.kml',
  fileSize: 48512,
  extendedKeys: ['ID_Tower', 'Provider', 'Ketinggian_Tower_m', 'Status_Operasional_2026', 'Kabupaten_Kota'],
  folders: ['Zona Utara > Menara Utama', 'Zona Pusat > Mikro Seluler', 'Zona Selatan'],
  placemarks: [
    {
      id: 'mock-1',
      name: 'Tower BTS Monas - T1',
      description: 'Menara telekomunikasi pusat transmisi telekomunikasi DKI Jakarta.',
      geometryType: 'Point',
      folderPath: 'Zona Pusat > Mikro Seluler',
      styleColor: 'rgba(239, 68, 68, 0.8)', // Red
      styleWidth: 3,
      coordinates: [{ lng: 106.827153, lat: -6.175392, alt: 115.4 }],
      extendedData: {
        'ID_Tower': 'BTS-JKT-001',
        'Provider': 'Telkomsel',
        'Ketinggian_Tower_m': '115',
        'Status_Operasional_2026': 'Aktif Mendukung 5G-Advanced',
        'Kabupaten_Kota': 'Jakarta Pusat'
      }
    },
    {
      id: 'mock-2',
      name: 'Tower BTS Gambir - T2',
      description: 'Pemancar cadangan area stasiun perkeretaapian DKI Jakarta.',
      geometryType: 'Point',
      folderPath: 'Zona Pusat > Mikro Seluler',
      styleColor: 'rgba(59, 130, 246, 0.8)', // Blue
      styleWidth: 3,
      coordinates: [{ lng: 106.8307, lat: -6.1767, alt: 45.2 }],
      extendedData: {
        'ID_Tower': 'BTS-JKT-002',
        'Provider': 'Indosat Ooredoo Hutchison',
        'Ketinggian_Tower_m': '45',
        'Status_Operasional_2026': 'Aktif / Optimal',
        'Kabupaten_Kota': 'Jakarta Pusat'
      }
    },
    {
      id: 'mock-3',
      name: 'Batas Wilayah Kawasan Monas (Poligon)',
      description: 'Batas pagar keliling silang Monumen Nasional Jakarta.',
      geometryType: 'Polygon',
      folderPath: 'Zona Pusat > Mikro Seluler',
      styleColor: 'rgba(16, 185, 129, 0.35)', // Transparent Emerald
      styleWidth: 2,
      coordinates: [
        { lng: 106.823625, lat: -6.171852, alt: null },
        { lng: 106.831032, lat: -6.171731, alt: null },
        { lng: 106.830946, lat: -6.178822, alt: null },
        { lng: 106.823432, lat: -6.178731, alt: null },
        { lng: 106.823625, lat: -6.171852, alt: null }, // Closed ring
      ],
      extendedData: {
        'ID_Tower': 'N/A',
        'Provider': 'Dinas Pertamanan & Hutan Kota',
        'Ketinggian_Tower_m': '0',
        'Status_Operasional_2026': 'Situs Cagar Budaya Protektif',
        'Kabupaten_Kota': 'Jakarta Pusat'
      }
    },
    {
      id: 'mock-4',
      name: 'Koridor Kabel Optik Monas-Kemayoran',
      description: 'Rantai kabel serat optik bawah tanah kecepatan tinggi.',
      geometryType: 'LineString',
      folderPath: 'Zona Utara > Menara Utama',
      styleColor: 'rgba(245, 158, 11, 0.9)', // Amber
      styleWidth: 4,
      coordinates: [
        { lng: 106.827153, lat: -6.175392, alt: 0 },
        { lng: 106.8335, lat: -6.1712, alt: 2 },
        { lng: 106.8381, lat: -6.1667, alt: 1 },
        { lng: 106.8452, lat: -6.1611, alt: 0 },
      ],
      extendedData: {
        'ID_Tower': 'FO-LINE-992',
        'Provider': 'Icon+',
        'Ketinggian_Tower_m': 'N/A',
        'Status_Operasional_2026': 'Aktif Beroperasi',
        'Kabupaten_Kota': 'Jakarta Utara'
      }
    },
    {
      id: 'mock-5',
      name: 'BTS Pancoran Supertower',
      description: 'Menara pancang tinggi kokoh area Patung Pancoran.',
      geometryType: 'Point',
      folderPath: 'Zona Selatan',
      styleColor: 'rgba(139, 92, 246, 0.85)', // Violet
      styleWidth: 3,
      coordinates: [{ lng: 106.8428, lat: -6.2435, alt: 85.0 }],
      extendedData: {
        'ID_Tower': 'BTS-JKT-104',
        'Provider': 'XL Axiata',
        'Ketinggian_Tower_m': '85',
        'Status_Operasional_2026': 'Pemeliharaan Terjadwal',
        'Kabupaten_Kota': 'Jakarta Selatan'
      }
    },
    {
      id: 'mock-6',
      name: 'Batas Lahan Komplek Gelora Bung Karno',
      description: 'Poligon plot kawasan stadion utama senayan GBK Jakarta.',
      geometryType: 'Polygon',
      folderPath: 'Zona Selatan',
      styleColor: 'rgba(236, 72, 153, 0.3)', // Pink
      styleWidth: 2,
      coordinates: [
        { lng: 106.7972, lat: -6.2132, alt: null },
        { lng: 106.8068, lat: -6.2135, alt: null },
        { lng: 106.8065, lat: -6.2238, alt: null },
        { lng: 106.7975, lat: -6.2231, alt: null },
        { lng: 106.7972, lat: -6.2132, alt: null },
      ],
      extendedData: {
        'ID_Tower': 'N/A',
        'Provider': 'Sekretariat Negara',
        'Ketinggian_Tower_m': '0',
        'Status_Operasional_2026': 'Situs Utama Kegiatan Olahraga nasional',
        'Kabupaten_Kota': 'Jakarta Pusat'
      }
    },
    {
      id: 'mock-dropwire-1',
      name: 'DROPWIRE - ODP-KBY-04 s.d Rumah Pelanggan',
      description: 'Kabel dropwire pelanggan FTTH High Speed fiber optic.',
      geometryType: 'LineString',
      folderPath: 'Zona Selatan',
      styleColor: 'rgba(236, 72, 153, 0.95)', // Solid pink
      styleWidth: 3.5,
      coordinates: [
        { lng: 106.8428, lat: -6.2435, alt: 12 }, // Pole/ODP Pancoran
        { lng: 106.8435, lat: -6.2442, alt: 9 },  // Mid segment pole
        { lng: 106.8441, lat: -6.2448, alt: 4 }   // Last vertex: Customer House
      ],
      extendedData: {
        'ID_Tower': 'DW-901-CUST',
        'Provider': 'MyRepublic / Biznet',
        'Ketinggian_Tower_m': 'N/A',
        'Status_Operasional_2026': 'Aktif 150 Mbps',
        'Kabupaten_Kota': 'Jakarta Selatan'
      }
    }
  ]
};

export const SAMPLE_ROUTE_BANDUNG: ParseResult = {
  fileName: 'Rute_Sepeda_Alam_Sari_Bandung.kml',
  fileSize: 32210,
  extendedKeys: ['Kesulitan_Grade', 'Est_Waktu_Menit', 'Kondisi_Jalan', 'Elevasi_Maks_Meter'],
  folders: ['Rute Pegunungan', 'Pos Rest-Area'],
  placemarks: [
    {
      id: 'mock-b1',
      name: 'Rute Utama Downhill Cikole',
      description: 'Rute terjal berbatu dan tanah liat hutan pinus Lembang.',
      geometryType: 'LineString',
      folderPath: 'Rute Pegunungan',
      styleColor: 'rgba(220, 38, 38, 0.95)', // Strong Red
      styleWidth: 4,
      coordinates: [
        { lng: 107.6521, lat: -6.7821, alt: 1450 },
        { lng: 107.6534, lat: -6.7852, alt: 1420 },
        { lng: 107.6562, lat: -6.7885, alt: 1395 },
        { lng: 107.6588, lat: -6.7912, alt: 1370 },
        { lng: 107.6625, lat: -6.7938, alt: 1332 },
        { lng: 107.6661, lat: -6.7975, alt: 1290 }
      ],
      extendedData: {
        'Kesulitan_Grade': 'Hard / Pro',
        'Est_Waktu_Menit': '35',
        'Kondisi_Jalan': 'Tanah, Akar & Kerikil Tajam',
        'Elevasi_Maks_Meter': '1450'
      }
    },
    {
      id: 'mock-b2',
      name: 'Pos Istirahat Pinus Teduh',
      description: 'Titik pos pengisian air minum, kamar mandi dan shelter darurat.',
      geometryType: 'Point',
      folderPath: 'Pos Rest-Area',
      styleColor: 'rgba(16, 185, 129, 0.9)', // Emerald
      styleWidth: 2,
      coordinates: [{ lng: 107.6562, lat: -6.7885, alt: 1395 }],
      extendedData: {
        'Kesulitan_Grade': 'N/A',
        'Est_Waktu_Menit': 'N/A',
        'Kondisi_Jalan': 'Paving Block',
        'Elevasi_Maks_Meter': '1395'
      }
    },
    {
      id: 'mock-b3',
      name: 'Zona Camp Terpadu',
      description: 'Lahan berkemah keluarga yang aman dengan panorama tangkuban parahu.',
      geometryType: 'Polygon',
      folderPath: 'Pos Rest-Area',
      styleColor: 'rgba(59, 130, 246, 0.4)', // transparent blue
      styleWidth: 2,
      coordinates: [
        { lng: 107.6601, lat: -6.7951, alt: 1310 },
        { lng: 107.6631, lat: -6.7941, alt: 1305 },
        { lng: 107.6625, lat: -6.7972, alt: 1300 },
        { lng: 107.6598, lat: -6.7968, alt: 1308 },
        { lng: 107.6601, lat: -6.7951, alt: 1310 },
      ],
      extendedData: {
        'Kesulitan_Grade': 'Easy',
        'Est_Waktu_Menit': 'N/A',
        'Kondisi_Jalan': 'Rumput Hijau Terbuka',
        'Elevasi_Maks_Meter': '1310'
      }
    }
  ]
};
