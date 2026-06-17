import * as XLSX from 'xlsx-js-style';
import { KMLPlacemark, Coordinate } from './kmlParser';

/**
 * Calculates great-circle distance between two points using the Haversine Formula.
 * Returns distance in meters.
 */
export function calculateDistance(c1: Coordinate, c2: Coordinate): number {
  const R = 6371000; // Radius of Earth in meters
  const dLat = ((c2.lat - c1.lat) * Math.PI) / 180;
  const dLng = ((c2.lng - c1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((c1.lat * Math.PI) / 180) *
      Math.cos((c2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Finds the nearest point (pole) relative to a given point inside a list.
 * Returns the name of that nearest point and the great-circle distance in meters.
 */
export function findNearestPointDistance(
  pm: KMLPlacemark,
  allPlacemarks: KMLPlacemark[]
): { distance: number; name: string } | null {
  if (pm.coordinates.length === 0) return null;
  const cA = pm.coordinates[0];

  let minDistance = Infinity;
  let nearestPm: KMLPlacemark | null = null;

  for (const other of allPlacemarks) {
    if (other.id === pm.id) continue;

    // Only search among points or single coordinate items
    const isPoint = other.geometryType === 'Point' || other.coordinates.length === 1;
    if (!isPoint || other.coordinates.length === 0) continue;

    const cB = other.coordinates[0];
    const dist = calculateDistance(cA, cB);
    if (dist < minDistance) {
      minDistance = dist;
      nearestPm = other;
    }
  }

  if (minDistance === Infinity || !nearestPm) return null;
  return { distance: minDistance, name: nearestPm.name };
}

/**
 * Finds the nearest point (pole/ODP) relative to a given coordinate.
 * Returns the name of that nearest point and the distance in meters.
 */
export function findNearestPointToCoordinate(
  coord: Coordinate,
  excludeId: string,
  allPlacemarks: KMLPlacemark[]
): { distance: number; name: string } | null {
  let minDistance = Infinity;
  let nearestPm: KMLPlacemark | null = null;

  for (const other of allPlacemarks) {
    if (other.id === excludeId) continue;

    const isPoint = other.geometryType === 'Point' || other.coordinates.length === 1;
    if (!isPoint || other.coordinates.length === 0) continue;

    const cB = other.coordinates[0];
    const dist = calculateDistance(coord, cB);
    if (dist < minDistance) {
      minDistance = dist;
      nearestPm = other;
    }
  }

  if (minDistance === Infinity || !nearestPm) return null;
  return { distance: minDistance, name: nearestPm.name };
}

/**
 * Finds the nearest FAT point relative to a given coordinate.
 */
export function findNearestFatPoint(
  coord: Coordinate,
  excludeId: string,
  allPlacemarks: KMLPlacemark[]
): { distance: number; name: string } | null {
  let minDistance = Infinity;
  let nearestPm: KMLPlacemark | null = null;

  for (const other of allPlacemarks) {
    if (other.id === excludeId) continue;

    const isPoint = other.geometryType === 'Point' || other.coordinates.length === 1;
    if (!isPoint || other.coordinates.length === 0) continue;

    const nameUpper = other.name ? other.name.toUpperCase() : '';
    const folderUpper = other.folderPath ? other.folderPath.toUpperCase() : '';
    const isFat = nameUpper.startsWith('FAT') || nameUpper.includes('FAT-') || nameUpper.includes('FDT-') || nameUpper.includes('ODP-') || folderUpper.includes('FAT') || folderUpper.includes('FDT') || folderUpper.includes('ODP');
    
    if (!isFat) continue;

    const cB = other.coordinates[0];
    const dist = calculateDistance(coord, cB);
    if (dist < minDistance) {
      minDistance = dist;
      nearestPm = other;
    }
  }

  if (minDistance === Infinity || !nearestPm) return null;
  return { distance: minDistance, name: nearestPm.name };
}

/**
 * Unified detector to tell if a placemark is a Homepass node.
 */
export function isHomepassPlacemark(pm: KMLPlacemark): boolean {
  const isPoint = pm.geometryType === 'Point' || pm.coordinates.length === 1;
  if (!isPoint || pm.coordinates.length === 0) return false;

  // Prioritize style icon: homepass = placemark_circle.png or b.png/B.png
  if (pm.styleIcon) {
    const iconLower = pm.styleIcon.toLowerCase();
    if (
      iconLower.includes('placemark_circle') || 
      iconLower.includes('placemark_circle.png') ||
      iconLower.includes('/b.png') ||
      iconLower === 'b.png' ||
      iconLower.endsWith('b.png')
    ) {
      return true;
    }
  }

  // If the placemark's name or folder mentions POLE or TIANG, it is not a Homepass node.
  const nameUpper = pm.name ? pm.name.toUpperCase().trim() : '';
  const folderUpper = pm.folderPath ? pm.folderPath.toUpperCase().trim() : '';
  if (
    nameUpper.includes('POLE') ||
    nameUpper.includes('TIANG') ||
    folderUpper.includes('POLE') ||
    folderUpper.includes('TIANG')
  ) {
    return false;
  }

  // 1. Check Extended Data Keys and values
  const hasHpKey = Object.keys(pm.extendedData).some(k => {
    const kl = k.toLowerCase();
    return kl.includes('homepass') || kl.includes('hp id') || kl.includes('hp_id') || kl.includes('hp-id') || kl === 'hp' || kl === 'id' || kl.includes('hp-');
  });
  if (hasHpKey) return true;

  // 2. Check Name patterns
  if (pm.name) {
    if (
      nameUpper.includes('HOMEPASS') ||
      nameUpper.includes('HOME PASS') ||
      nameUpper.startsWith('?-') ||
      nameUpper.startsWith('HP') ||
      nameUpper.includes('HP-') ||
      nameUpper.includes('HP_') ||
      nameUpper.includes('HP ') ||
      /^HP[-_ \.]?\d+/i.test(pm.name)
    ) {
      return true;
    }
  }

  // 3. Check Folder Path
  if (pm.folderPath) {
    if (folderUpper.includes('HOMEPASS') || folderUpper.includes('HOME PASS') || folderUpper.includes('HP')) {
      return true;
    }
  }

  return false;
}

/**
 * Finds the nearest Homepass (HP ID) point relative to a given coordinate.
 */
export function findNearestHomepassPoint(
  coord: Coordinate,
  excludeId: string,
  allPlacemarks: KMLPlacemark[]
): { distance: number; name: string } | null {
  let minDistance = Infinity;
  let nearestPm: KMLPlacemark | null = null;

  for (const other of allPlacemarks) {
    if (other.id === excludeId) continue;
    if (!isHomepassPlacemark(other)) continue;

    const cB = other.coordinates[0];
    const dist = calculateDistance(coord, cB);
    if (dist < minDistance) {
      minDistance = dist;
      nearestPm = other;
    }
  }

  if (minDistance === Infinity || !nearestPm) return null;
  const hpId = getHomepassValue(nearestPm);
  const displayName = hpId !== '-' ? `${nearestPm.name} [ID: ${hpId}]` : nearestPm.name;
  return { distance: minDistance, name: displayName };
}

/**
 * Detects if a placemark list is a Homepass dataset.
 */
export function isHomepassList(plist: KMLPlacemark[]): boolean {
  if (plist.length === 0) return false;
  
  // If the list of points belongs to SPAN or Q SPAN, it is not a Homepass list.
  const hasSpan = plist.some(pm => {
    const nameUpper = pm.name ? pm.name.toUpperCase() : '';
    const folderUpper = pm.folderPath ? pm.folderPath.toUpperCase() : '';
    return nameUpper.includes('SPAN') || nameUpper.includes('QSPAN') || folderUpper.includes('SPAN') || folderUpper.includes('QSPAN');
  });
  if (hasSpan) return false;
  
  // If the list represents poles, it is not a Homepass list.
  const hasPole = plist.some(pm => {
    const nameUpper = pm.name ? pm.name.toUpperCase() : '';
    const folderUpper = pm.folderPath ? pm.folderPath.toUpperCase() : '';
    return nameUpper.includes('POLE') || nameUpper.includes('TIANG') || folderUpper.includes('POLE') || folderUpper.includes('TIANG');
  });
  if (hasPole) return false;

  // If the list represents OLT, it is not a Homepass list.
  const hasOlt = plist.some(pm => {
    const nameUpper = pm.name ? pm.name.toUpperCase() : '';
    const folderUpper = pm.folderPath ? pm.folderPath.toUpperCase() : '';
    return nameUpper.includes('OLT') || folderUpper.includes('OLT');
  });
  if (hasOlt) return false;

  return plist.some(pm => isHomepassPlacemark(pm));
}

/**
 * Gets the actual value for Homepass ID from extendedData if possible.
 */
export function getHomepassValue(pm: KMLPlacemark): string {
  const keys = Object.keys(pm.extendedData);
  
  // 1. Try exact matches case-insensitively with target patterns
  const exactTargets = [
    'homepass_id', 'homepass id', 'homepassid', 'homepass-id',
    'hp_id', 'hp id', 'hpid', 'hp-id',
    'id_hp', 'id hp', 'id-hp', 'idhp',
    'id_homepass', 'id homepass', 'id-homepass', 'idhomepass',
    'no_homepass', 'no homepass', 'nohomepass',
    'homepass_no', 'homepass no', 'homepassno',
    'hp_no', 'hp no', 'hpno', 'hp_num', 'hp num'
  ];
  for (const target of exactTargets) {
    for (const k of keys) {
      if (k.toLowerCase().trim() === target) {
        return pm.extendedData[k];
      }
    }
  }

  // 2. Try looser case-insensitive patterns
  for (const k of keys) {
    const rkl = k.toLowerCase().trim();
    if (rkl.includes('homepass') && (rkl.includes('id') || rkl.includes('no') || rkl.includes('kode') || rkl.includes('num') || rkl.includes('val'))) {
      return pm.extendedData[k];
    }
    if (rkl.includes('hp') && (rkl.includes('id') || rkl.includes('no') || rkl.includes('kode') || rkl.includes('num') || rkl.includes('val'))) {
      return pm.extendedData[k];
    }
  }

  // 3. Fallback contains homepass or is exactly hp/id
  for (const k of keys) {
    const rkl = k.toLowerCase().trim();
    if (rkl.includes('homepass') || rkl === 'hp' || rkl === 'id') {
      return pm.extendedData[k];
    }
  }

  // 4. Try from the name of the placemark if it looks like HP-xxxx or similar
  if (pm.name) {
    const hpMatch = pm.name.match(/HP[-_ \.]?(\d+)/i);
    if (hpMatch) {
      return hpMatch[1];
    }
    const hpGeneralMatch = pm.name.match(/(?:HOMEPASS|HP)[-_ \.]?([a-zA-Z0-9]+)/i);
    if (hpGeneralMatch) {
      return hpGeneralMatch[1];
    }
  }

  return '-';
}

/**
 * Detects if a placemark list is a Cable Distribution dataset.
 */
export function isCableDistributionList(plist: KMLPlacemark[]): boolean {
  if (plist.length === 0) return false;
  return plist.some(pm => {
    const nameUpper = pm.name ? pm.name.toUpperCase() : '';
    const folderUpper = pm.folderPath ? pm.folderPath.toUpperCase() : '';
    
    const hasCableKeywords = nameUpper.includes('ADSS') || 
                             nameUpper.includes('CABLE') || 
                             nameUpper.includes('DISTRIBUTION') || 
                             nameUpper.includes('KABEL') || 
                             nameUpper.includes('DISTRIBUSI');
                             
    const folderHasCable = folderUpper.includes('CABLE') || 
                           folderUpper.includes('DISTRIBUTION') || 
                           folderUpper.includes('DISTRIBUSI') || 
                           folderUpper.includes('KABEL');
                           
    return hasCableKeywords || folderHasCable;
  });
}

/**
 * Detects if a placemark list is a FAT (Fiber Access Terminal) dataset.
 */
export function isFatList(plist: KMLPlacemark[]): boolean {
  if (plist.length === 0) return false;
  return plist.some(pm => {
    const nameUpper = pm.name ? pm.name.toUpperCase() : '';
    const folderUpper = pm.folderPath ? pm.folderPath.toUpperCase() : '';
    return nameUpper.startsWith('FAT') || nameUpper.includes('FAT-') || nameUpper.includes('FDT-') || nameUpper.includes('ODP-') || folderUpper.includes('FAT') || folderUpper.includes('FDT') || folderUpper.includes('ODP');
  });
}

/**
 * Detects if a placemark list is a FAT AREA (boundary polygon) dataset.
 */
export function isFatAreaList(plist: KMLPlacemark[]): boolean {
  if (plist.length === 0) return false;
  return plist.some(pm => {
    const folderUpper = pm.folderPath ? pm.folderPath.toUpperCase() : '';
    const nameUpper = pm.name ? pm.name.toUpperCase() : '';

    // Standard pattern checks:
    const containsFatArea = folderUpper.includes('FAT AREA') || folderUpper.includes('FDT AREA') || folderUpper.includes('ODP AREA') ||
                            folderUpper.includes('FAT_AREA') || folderUpper.includes('FDT_AREA') || folderUpper.includes('ODP_AREA') ||
                            folderUpper.includes('FAT-AREA') || folderUpper.includes('FDT-AREA') || folderUpper.includes('ODP-AREA') ||
                            folderUpper.includes('AREA FAT') || folderUpper.includes('AREA ODP') || folderUpper.includes('AREA FDT') ||
                            folderUpper.includes('COVERAGE FAT') || folderUpper.includes('COVERAGE ODP') || folderUpper.includes('COVERAGE FDT') ||
                            folderUpper.includes('FAT COVERAGE') || folderUpper.includes('ODP COVERAGE') || folderUpper.includes('FDT COVERAGE') ||
                            folderUpper.includes('WILAYAH FAT') || folderUpper.includes('WILAYAH ODP');
    if (containsFatArea) return true;

    const containsNameFatArea = nameUpper.includes('FAT AREA') || nameUpper.includes('FDT AREA') || nameUpper.includes('ODP AREA') ||
                                nameUpper.includes('FAT_AREA') || nameUpper.includes('FDT_AREA') || nameUpper.includes('ODP_AREA') ||
                                nameUpper.includes('FAT-AREA') || nameUpper.includes('FDT-AREA') || nameUpper.includes('ODP-AREA') ||
                                nameUpper.includes('AREA FAT') || nameUpper.includes('AREA ODP') || nameUpper.includes('AREA FDT') ||
                                nameUpper.includes('COVERAGE FAT') || nameUpper.includes('COVERAGE ODP') || nameUpper.includes('COVERAGE FDT') ||
                                nameUpper.includes('FAT COVERAGE') || nameUpper.includes('ODP COVERAGE') || nameUpper.includes('FDT COVERAGE');
    if (containsNameFatArea) return true;

    // Special Check: If the shape is a Polygon, and the name or folder path contains both a NODE keyword (FAT) and an AREA/WILAYAH keyword, or if it is a Polygon and the folder name contains FAT
    if (pm.geometryType === 'Polygon') {
      const isNode = folderUpper.includes('FAT') || nameUpper.includes('FAT');
      if (isNode) {
        const hasAreaWord = folderUpper.includes('AREA') || folderUpper.includes('COV') || folderUpper.includes('WILAYAH') || folderUpper.includes('SEKTOR') || folderUpper.includes('LAYANAN') || folderUpper.includes('BATAS') ||
                            nameUpper.includes('AREA') || nameUpper.includes('COV') || nameUpper.includes('WILAYAH') || nameUpper.includes('SEKTOR') || nameUpper.includes('LAYANAN') || nameUpper.includes('BATAS') ||
                            (folderUpper.trim() === 'FAT');
        if (hasAreaWord || isNode) return true;
      }
    }

    return false;
  });
}

/**
 * Checks if a point lies inside a polygon boundary using Ray Casting algorithm.
 */
export function isPointInPolygon(point: Coordinate, polygon: Coordinate[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  const x = point.lng;
  const y = point.lat;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersect = ((yi > y) !== (yj > y))
      && (x < (xj - xi) * (y - yi) / (yj - yi || 1) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Counts how many homepass points fall inside a polygon boundary.
 * For polygon names starting with 'FAT', we filter strictly based on the placemark_circle.png / placemark_circle icon.
 */
export function countHomepassInPolygon(polygonCoords: Coordinate[], allPlacemarks: KMLPlacemark[], polygonName?: string): number {
  if (polygonCoords.length < 3 || !allPlacemarks || allPlacemarks.length === 0) return 0;
  
  const polyNameUpper = polygonName ? polygonName.toUpperCase().trim() : '';
  const startsWithFat = polyNameUpper.startsWith('FAT');

  let count = 0;
  const homepasses = allPlacemarks.filter(pm => isHomepassPlacemark(pm));

  if (startsWithFat) {
    for (const hp of homepasses) {
      if (isPointInPolygon(hp.coordinates[0], polygonCoords)) {
        const styleIconLower = hp.styleIcon ? hp.styleIcon.toLowerCase() : '';
        const hasCircleIcon = styleIconLower.includes('placemark_circle') || 
                               styleIconLower.includes('placemark_circle.png') ||
                               styleIconLower.includes('/b.png') ||
                               styleIconLower === 'b.png' ||
                               styleIconLower.endsWith('b.png');
        if (hasCircleIcon) {
          count++;
        }
      }
    }
  } else {
    // Keep other data intact
    for (const hp of homepasses) {
      if (isPointInPolygon(hp.coordinates[0], polygonCoords)) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Calculates total path length (and perimeter for Polygons) in meters.
 * Measures every segment/vertex sequence of the path.
 */
export function calculatePlacemarkLength(coordinates: Coordinate[], geometryType: string, name?: string): number {
  if (coordinates.length < 2 || geometryType === 'Point') return 0;

  let totalDistance = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    totalDistance += calculateDistance(coordinates[i], coordinates[i + 1]);
  }
  
  // If Polygon, ensure it's closed loop distance to accurately denote perimeter
  if (geometryType === 'Polygon' && coordinates.length > 2) {
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    if (first.lat !== last.lat || first.lng !== last.lng) {
      totalDistance += calculateDistance(last, first);
    }
  }
  
  return totalDistance;
}

/**
 * Calculates only the last segment (the distance between the second-to-last and last vertex).
 * Relevant for special dropwire final vertex measurements.
 */
export function calculateLastSegmentLength(coordinates: Coordinate[]): number {
  if (coordinates.length < 2) return 0;
  return calculateDistance(coordinates[coordinates.length - 2], coordinates[coordinates.length - 1]);
}

/**
 * Human readable formatted string for length measurements.
 */
export function formatLength(meters: number, geometryType: string): string {
  if (meters === 0 || geometryType === 'Point') return '-';
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(3)} km`;
  }
  return `${meters.toFixed(1)} m`;
}

/**
 * Converts decimal degrees to Degrees Minutes Seconds (DMS) string.
 * Localized for Indonesian text (U, S, T, B)
 */
export function decimalToDms(val: number, isLat: boolean): string {
  const absolute = Math.abs(val);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const secondsStr = ((minutesNotTruncated - minutes) * 60).toFixed(2);
  
  let direction = '';
  if (isLat) {
    direction = val >= 0 ? 'LU' : 'LS'; // Lintang Utara, Lintang Selatan
  } else {
    direction = val >= 0 ? 'BT' : 'BB'; // Bujur Timur, Bujur Barat
  }
  
  return `${degrees}° ${minutes}' ${secondsStr}" ${direction}`;
}

/**
 * Calculate the average/centroid coordinate for points/polygons/lines.
 */
export function calculateCentroid(coordinates: Coordinate[]): Coordinate | null {
  if (coordinates.length === 0) return null;
  
  let totalLat = 0;
  let totalLng = 0;
  let totalAlt = 0;
  let countAlt = 0;

  for (const c of coordinates) {
    totalLat += c.lat;
    totalLng += c.lng;
    if (c.alt !== null) {
      totalAlt += c.alt;
      countAlt++;
    }
  }

  return {
    lat: totalLat / coordinates.length,
    lng: totalLng / coordinates.length,
    alt: countAlt > 0 ? totalAlt / countAlt : null
  };
}

export interface ExporterConfig {
  includeDms: boolean;
  includeFlatCoords: boolean;
  exportVertexSheet: boolean;
  customColumns: string[];
  tolerance?: number;
}

/**
 * Generates unique, safe sheet names with Excel's 31-characters limit
 * and characters restriction (: \ / ? * [ ]).
 */
export function getUniqueSheetName(name: string, existingNames: Set<string>): string {
  // If the folder name is a hierarchy, extract the leaf name (the last part)
  let leafName = name;
  if (name.includes(' > ')) {
    const parts = name.split(' > ');
    leafName = parts[parts.length - 1];
  }

  let baseName = leafName.replace(/[:\\/?*\[\]]/g, '_').trim();
  if (baseName.length > 31) {
    baseName = baseName.substring(0, 31);
  }
  if (!baseName) {
    baseName = 'Folder';
  }
  
  let candidate = baseName;
  let counter = 1;
  while (existingNames.has(candidate.toLowerCase())) {
    const suffix = ` (${counter})`;
    const maxBaseLen = 31 - suffix.length;
    candidate = baseName.substring(0, maxBaseLen) + suffix;
    counter++;
  }
  existingNames.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Creates rows data from placemarks list for spreadsheet summary
 */
export function createPlacemarkRows(
  plist: KMLPlacemark[],
  config: ExporterConfig,
  sheetNameMap?: Record<string, string>,
  allPlacemarks: KMLPlacemark[] = []
): Record<string, any>[] {
  const rows = _createPlacemarkRowsRaw(plist, config, sheetNameMap, allPlacemarks);
  
  const isQSpan = plist.some(pm => {
    const nameUpper = pm.name ? pm.name.toUpperCase() : '';
    const folderUpper = pm.folderPath ? pm.folderPath.toUpperCase() : '';
    const mappedFolder = sheetNameMap && pm.folderPath && sheetNameMap[pm.folderPath.trim()] 
      ? sheetNameMap[pm.folderPath.trim()].toUpperCase() 
      : '';
    return nameUpper.includes('Q SPAN') || nameUpper.includes('QSPAN') || 
           folderUpper.includes('Q SPAN') || folderUpper.includes('QSPAN') || 
           mappedFolder.includes('Q SPAN') || mappedFolder.includes('QSPAN') ||
           folderUpper.includes('SPAN') || mappedFolder.includes('SPAN') ||
           nameUpper.includes('SPAN');
  });

  if (isQSpan) {
    rows.forEach(row => {
      delete row['Homepass Id'];
      delete row['Jarak Terdekat (m)'];
      delete row['Homepass Terdekat'];
    });
  }

  const isOlt = plist.some(pm => {
    const nameUpper = pm.name ? pm.name.toUpperCase() : '';
    const folderUpper = pm.folderPath ? pm.folderPath.toUpperCase() : '';
    const mappedFolder = sheetNameMap && pm.folderPath && sheetNameMap[pm.folderPath.trim()] 
      ? sheetNameMap[pm.folderPath.trim()].toUpperCase() 
      : '';
    return nameUpper.includes('OLT') || 
           folderUpper.includes('OLT') || 
           mappedFolder.includes('OLT');
  });

  if (isOlt) {
    rows.forEach(row => {
      delete row['Homepass Id'];
      delete row['Jarak Terdekat (m)'];
      delete row['Homepass Terdekat'];
    });
  }

  const isDropwireSheet = plist.some(pm => {
    const nameUpper = pm.name ? pm.name.toUpperCase() : '';
    const folderUpper = pm.folderPath ? pm.folderPath.toUpperCase() : '';
    const mappedFolder = sheetNameMap && pm.folderPath && sheetNameMap[pm.folderPath.trim()] 
      ? sheetNameMap[pm.folderPath.trim()].toUpperCase() 
      : '';
    return nameUpper.includes('DROPWIRE') || 
           folderUpper.includes('DROPWIRE') || 
           mappedFolder.includes('DROPWIRE');
  });

  if (isDropwireSheet) {
    rows.forEach((row, index) => {
      // 1. Remove DMS columns
      delete row['DMS Latitude (Lintang)'];
      delete row['DMS Longitude (Bujur)'];
      delete row['DMS Latitude'];
      delete row['DMS Longitude'];

      // 2. Remove flat coordinates columns
      delete row['Seluruh Koordinat (Lng,Lat,Alt)'];
      delete row['Seluruh Koordinat'];

      // 3. Remove metadata and custom extended data columns
      config.customColumns.forEach(key => {
        delete row[key];
      });

      const forbiddenKeys = [
        'DMS Latitude (Lintang)', 'DMS Longitude (Bujur)', 'HOUSE_NUMBER', 'CLUSTER_NAME', 'CLUSTER_CODE', 
        'STREET_NAME', 'BLOCK', 'RT', 'RW', 'DISTRICT', 'SUB_DISTRICT', 'FDT_CODE', 'FAT_LATITUDE', 
        'FAT_LONGITUDE', 'BUILDING_LATITUDE', 'BUILDING_LONGITUDE', 'HOMEPASS_ID', 'NETID', 'ELEMENTID', 
        'RANK', 'LEVEL', 'CONNSTATUS', 'CONNSUPPRT', 'SUPPORT', 'NAME', 'INFRAID', 'INFRACONID', 
        'ROUTINGID', 'LOCATIONS', 'PREMISES', 'EQUIPMENT', 'COST', 'PRIID', 'PRIDIST', 'SUPID', 
        'SUPDIST', 'MINPPDIST', 'MAXPPDIST', 'TOTPPDIST', 'NODEFC', 'SUBNETCOST', 'PPAVGCOST', 
        'USEFUS', 'SPRFUS', 'USEFDS', 'SPRFDS', 'SUPNAME', 'SPLITTERS', 'MODELNUM', 'FIBERS', 
        'TUBESIZE', 'ALLOCFIB', 'SPAREFIB', 'SPRFNEED', 'LENGTH', 'INFRALEN', 'ENDAID', 'ENDBID', 
        'NODEAID', 'NODEBID', 'CLOSUREAID', 'MIDCLOSLST', 'CLOSUREBID', 'INFRAAID', 'INFRABID', 
        'ROUTINGAID', 'ROUTINGBID', 'DEVICEAID', 'DVICETYPEA', 'DEVICEBID', 'DVICETYPEB'
      ];

      forbiddenKeys.forEach(k => {
        delete row[k];
        delete row[k.toUpperCase()];
        delete row[k.toLowerCase()];
      });

      // Remove any dynamic segment column keys like "Segmen 1", "Segmen 2", etc.
      Object.keys(row).forEach(key => {
        if (/^Segmen \d+$/i.test(key)) {
          delete row[key];
        }
      });

      // 4. Retrieve closest point coordinates with "placemark_circle.png" or "B.png" style icon
      const pm = plist[index];
      let endpointCoordsStr = '-';
      let hpIdVal = '-';
      if (pm && pm.coordinates && pm.coordinates.length > 0) {
        const searchPool = allPlacemarks && allPlacemarks.length > 0 ? allPlacemarks : plist;
        const candidates = searchPool.filter(other => {
          if (other.id === pm.id) return false;
          const isPoint = other.geometryType === 'Point' || other.coordinates.length === 1;
          if (!isPoint || other.coordinates.length === 0) return false;

          if (other.styleIcon) {
            const iconLower = other.styleIcon.toLowerCase();
            if (
              iconLower.includes('placemark_circle') || 
              iconLower.includes('/b.png') ||
              iconLower === 'b.png' ||
              iconLower.endsWith('b.png')
            ) {
              return true;
            }
          }
          return false;
        });

        if (candidates.length > 0) {
          // Find the candidate closest to any of the dropwire line coordinates, prioritizing the last point (ujung dropwire)
          const lastPoint = pm.coordinates[pm.coordinates.length - 1];
          let minDistance = Infinity;
          let nearestCand: KMLPlacemark | null = null;

          for (const cand of candidates) {
            const candCoord = cand.coordinates[0];
            if (!candCoord) continue;
            const dist = calculateDistance(lastPoint, candCoord);
            if (dist < minDistance) {
              minDistance = dist;
              nearestCand = cand;
            }
          }

          // Fallback to check start point of the line as well
          const firstPoint = pm.coordinates[0];
          if (firstPoint) {
            for (const cand of candidates) {
              const candCoord = cand.coordinates[0];
              if (!candCoord) continue;
              const dist = calculateDistance(firstPoint, candCoord);
              if (dist < minDistance) {
                minDistance = dist;
                nearestCand = cand;
              }
            }
          }

          if (nearestCand && nearestCand.coordinates && nearestCand.coordinates.length > 0) {
            const matchCoord = nearestCand.coordinates[0];
            // Format coordinates in decimal degree format (Lat, Lng) with 8 decimal places
            endpointCoordsStr = `${matchCoord.lat.toFixed(8)}, ${matchCoord.lng.toFixed(8)}`;
            hpIdVal = getHomepassValue(nearestCand);
          }
        }
      }

      // Add to the rightmost column as requested
      row['Koordinat Ujung'] = endpointCoordsStr;
      row['HP_ID'] = hpIdVal;
    });
  }

  return rows;
}

function _createPlacemarkRowsRaw(
  plist: KMLPlacemark[],
  config: ExporterConfig,
  sheetNameMap?: Record<string, string>,
  allPlacemarks: KMLPlacemark[] = []
): Record<string, any>[] {
  const allPoints = plist.length > 0 && plist.every(pm => pm.geometryType === 'Point' || pm.coordinates.length <= 1);

  if (allPoints) {
    const isHp = isHomepassList(plist);
    const isFat = isFatList(plist);

    if (isFat) {
      return plist.map((pm, index) => {
        const centroid = calculateCentroid(pm.coordinates);
        const primaryLat = centroid ? centroid.lat : '';
        const primaryLng = centroid ? centroid.lng : '';
        return {
          'No': index + 1,
          'Nama Objek': pm.name,
          'Latitude': primaryLat !== '' ? Number(primaryLat) : '-',
          'Longitude': primaryLng !== '' ? Number(primaryLng) : '-',
        };
      });
    }

    return plist.map((pm, index) => {
      const centroid = calculateCentroid(pm.coordinates);
      const primaryLat = centroid ? centroid.lat : '';
      const primaryLng = centroid ? centroid.lng : '';
      const nearest = findNearestPointDistance(pm, plist);

      if (isHp) {
        const hpVal = getHomepassValue(pm);
        return {
          'No': index + 1,
          'Nama Objek': pm.name,
          'Homepass Id': hpVal,
          'Latitude': primaryLat !== '' ? Number(Number(primaryLat).toFixed(6)) : '-',
          'Longitude': primaryLng !== '' ? Number(Number(primaryLng).toFixed(6)) : '-',
          'Jarak Terdekat (m)': nearest ? Number(nearest.distance.toFixed(2)) : '-',
          'Homepass Terdekat': nearest ? nearest.name : '-',
        };
      }

      const baseRow: Record<string, any> = {
        'No': index + 1,
        'Nama Objek': pm.name,
        'Latitude': primaryLat !== '' ? Number(Number(primaryLat).toFixed(8)) : '-',
        'Longitude': primaryLng !== '' ? Number(Number(primaryLng).toFixed(8)) : '-',
        'Jarak Terdekat (m)': nearest ? Number(nearest.distance.toFixed(2)) : '-',
        'Pole Terdekat': nearest ? nearest.name : '-',
      };

      return baseRow;
    });
  }

  const isFatAreaVal = isFatAreaList(plist);
  if (isFatAreaVal) {
    return plist.map((pm, index) => {
      const lengthMeters = calculatePlacemarkLength(pm.coordinates, pm.geometryType, pm.name);
      const hpCount = countHomepassInPolygon(pm.coordinates, allPlacemarks, pm.name);
      return {
        'No': index + 1,
        'Nama Objek': pm.name,
        'Area': lengthMeters > 0 ? `${lengthMeters.toFixed(1)} m` : '-',
        'Jumlah Homepass': hpCount,
      };
    });
  }

  const hasDropwire = false;

  const isDropwireSheet = plist.some(pm => {
    const nameUpper = pm.name ? pm.name.toUpperCase() : '';
    const folderUpper = pm.folderPath ? pm.folderPath.toUpperCase() : '';
    const mappedFolder = sheetNameMap && pm.folderPath && sheetNameMap[pm.folderPath.trim()] 
      ? sheetNameMap[pm.folderPath.trim()].toUpperCase() 
      : '';
    return nameUpper.includes('DROPWIRE') || 
           folderUpper.includes('DROPWIRE') || 
           mappedFolder.includes('DROPWIRE');
  });

  const isCable = false;

  // Find maximum segments across all placemarks in this list to pre-define the column structures
  let maxSegments = 0;
  if (!hasDropwire) {
    plist.forEach(pm => {
      if (pm.geometryType === 'LineString' && pm.coordinates.length > 1) {
        const segs = pm.coordinates.length - 1;
        if (segs > maxSegments) {
          maxSegments = segs;
        }
      }
    });
  }

  return plist.map((pm, index) => {
    const centroid = calculateCentroid(pm.coordinates);
    const coordCount = pm.coordinates.length;
    const lengthMeters = calculatePlacemarkLength(pm.coordinates, pm.geometryType, pm.name);

    // Get primary coordinate (first one or centroid)
    const primaryLat = centroid ? centroid.lat : '';
    const primaryLng = centroid ? centroid.lng : '';
    const primaryAlt = (centroid && centroid.alt !== null) ? centroid.alt : '';

    // Create a flat string list of all coordinates
    const flatCoords = config.includeFlatCoords 
      ? pm.coordinates.map(c => `${c.lng},${c.lat}${c.alt !== null ? `,${c.alt}` : ''}`).join('; ')
      : '';

    // Folder value from sheetNameMap or original
    const origFolder = pm.folderPath ? pm.folderPath.trim() : 'Utama';
    const folderValue = sheetNameMap && sheetNameMap[origFolder] ? sheetNameMap[origFolder] : origFolder;

    // Structured columns mirroring the user's premium layout at the front:
    const isLine = pm.geometryType === 'LineString';
    
    const baseRow: Record<string, any> = {
      'No': index + 1,
      'Nama Objek': pm.name,
      'Total Panjang': lengthMeters > 0 ? `${lengthMeters.toFixed(1)} m` : '-',
    };

    if (hasDropwire) {
      const isPmDropwire = pm.name && pm.name.toUpperCase().includes('DROPWIRE') && pm.geometryType === 'LineString';
      
      let fatTerdekatVal = '-';
      let hpTerdekatVal = '-';
      let lastPoleVal = '-';
      let masalah = '-';

      if (isPmDropwire) {
        const pts = pm.coordinates;
        const S = pts.length - 1;

        if (S < 1) {
          masalah = 'KML tidak valid (koordinat < 2)';
        } else {
          // Last segment is always LastPole
          const lastDist = calculateDistance(pts[pts.length - 2], pts[pts.length - 1]);
          lastPoleVal = `${lastDist.toFixed(1)} m`;

          const ptA = pts[0];
          const ptB = pts[pts.length - 1];

          // Use custom search to find nearest FAT and Homepass specifically
          const fatStart = findNearestFatPoint(ptA, pm.id, allPlacemarks);
          const fatEnd = findNearestFatPoint(ptB, pm.id, allPlacemarks);
          const hpStart = findNearestHomepassPoint(ptA, pm.id, allPlacemarks);
          const hpEnd = findNearestHomepassPoint(ptB, pm.id, allPlacemarks);

          if (fatStart && fatEnd) {
            // Pick based on which end is closer to its nearest FAT
            if (fatStart.distance < fatEnd.distance) {
              fatTerdekatVal = `${fatStart.name} (${fatStart.distance.toFixed(1)} m)`;
              if (hpEnd) {
                hpTerdekatVal = `${hpEnd.name} (${hpEnd.distance.toFixed(1)} m)`;
              }
            } else {
              fatTerdekatVal = `${fatEnd.name} (${fatEnd.distance.toFixed(1)} m)`;
              if (hpStart) {
                hpTerdekatVal = `${hpStart.name} (${hpStart.distance.toFixed(1)} m)`;
              }
            }
          } else if (fatStart) {
            fatTerdekatVal = `${fatStart.name} (${fatStart.distance.toFixed(1)} m)`;
            if (hpEnd) {
              hpTerdekatVal = `${hpEnd.name} (${hpEnd.distance.toFixed(1)} m)`;
            }
          } else if (fatEnd) {
            fatTerdekatVal = `${fatEnd.name} (${fatEnd.distance.toFixed(1)} m)`;
            if (hpStart) {
              hpTerdekatVal = `${hpStart.name} (${hpStart.distance.toFixed(1)} m)`;
            }
          } else {
            // General point nearest fallback
            const nearestStart = findNearestPointToCoordinate(ptA, pm.id, allPlacemarks);
            const nearestEnd = findNearestPointToCoordinate(ptB, pm.id, allPlacemarks);
            if (nearestStart) {
              fatTerdekatVal = `${nearestStart.name} (${nearestStart.distance.toFixed(1)} m)`;
            }
            if (nearestEnd) {
              hpTerdekatVal = `${nearestEnd.name} (${nearestEnd.distance.toFixed(1)} m)`;
            }
          }

          // Preserve warning message format
          if (S === 1) {
            masalah = 'Hanya memiliki 1 segmen';
          } else if (S === 2) {
            masalah = 'Hanya memiliki 2 segmen';
          } else {
            masalah = '-';
          }
        }
      }

      baseRow['LastPole'] = lastPoleVal;
      baseRow['FAT Terdekat'] = fatTerdekatVal;
      baseRow['Homepass Terdekat'] = hpTerdekatVal;
      baseRow['Masalah'] = masalah;
    } else {
      if (pm.geometryType === 'Polygon') {
        const hpCount = countHomepassInPolygon(pm.coordinates, allPlacemarks, pm.name);
        baseRow['Jumlah Homepass'] = hpCount;
        baseRow['Segmen Terakhir'] = '-';
      } else {
        if (isLine && pm.coordinates.length >= 2) {
          const lastLen = calculateDistance(pm.coordinates[pm.coordinates.length - 2], pm.coordinates[pm.coordinates.length - 1]);
          baseRow['Segmen Terakhir'] = `${lastLen.toFixed(2)} m`;
        } else {
          baseRow['Segmen Terakhir'] = '-';
        }
      }

      // Embed segments (ONLY for non-dropwire sheets)
      for (let i = 0; i < maxSegments; i++) {
        const colName = `Segmen ${i + 1}`;
        if (isLine && i < pm.coordinates.length - 1) {
          const segLen = calculateDistance(pm.coordinates[i], pm.coordinates[i + 1]);
          baseRow[colName] = `${segLen.toFixed(2)} m`;
        } else {
          baseRow[colName] = '';
        }
      }
    }

    const isDropwire = isDropwireSheet || !!(pm.name && pm.name.toUpperCase().includes('DROPWIRE'));

    // Add Degrees Minutes Seconds (DMS) if configured (ONLY for non-dropwire sheets)
    if (config.includeDms && !isDropwire && !hasDropwire) {
      baseRow['DMS Latitude (Lintang)'] = primaryLat !== '' ? decimalToDms(Number(primaryLat), true) : '-';
      baseRow['DMS Longitude (Bujur)'] = primaryLng !== '' ? decimalToDms(Number(primaryLng), false) : '-';
    }

    // Add custom extended data columns (ONLY for non-dropwire sheets)
    if (!isDropwire && !hasDropwire) {
      config.customColumns.forEach(key => {
        baseRow[key] = pm.extendedData[key] !== undefined ? pm.extendedData[key] : '-';
      });
    }

    // Add flat path/polygon string (ONLY for non-dropwire sheets)
    if (config.includeFlatCoords && !isDropwire && !hasDropwire) {
      baseRow['Seluruh Koordinat (Lng,Lat,Alt)'] = flatCoords || '-';
    }

    return baseRow;
  });
}

/**
 * Configure standard column widths for a placemark list summary sheet
 */
export function setSheetColumnWidths(
  ws: any,
  config: ExporterConfig,
  maxSegments: number = 0,
  isDropwireOnly: boolean = false,
  allPoints: boolean = false,
  isHomepass: boolean = false,
  isCable: boolean = false,
  isFat: boolean = false,
  isFatArea: boolean = false
) {
  if (isFatArea) {
    const summaryColsWidth = [
      { wch: 5 },   // No
      { wch: 25 },  // Nama Objek
      { wch: 18 },  // Area
      { wch: 18 },  // Jumlah Homepass
    ];
    ws['!cols'] = summaryColsWidth;
    return;
  }

  if (isFat) {
    const summaryColsWidth = [
      { wch: 5 },   // No
      { wch: 25 },  // Nama Objek
      { wch: 18 },  // Latitude
      { wch: 18 },  // Longitude
    ];
    ws['!cols'] = summaryColsWidth;
    return;
  }

  if (isCable) {
    const summaryColsWidth = [
      { wch: 5 },   // No
      { wch: 25 },  // Nama Objek
      { wch: 18 },  // Total Panjang
    ];
    ws['!cols'] = summaryColsWidth;
    return;
  }

  if (allPoints) {
    const summaryColsWidth = isHomepass ? [
      { wch: 5 },   // No
      { wch: 25 },  // Nama Objek
      { wch: 20 },  // Homepass Id
      { wch: 18 },  // Latitude
      { wch: 18 },  // Longitude
      { wch: 20 },  // Jarak Terdekat (m)
      { wch: 25 },  // Homepass Terdekat
    ] : [
      { wch: 5 },   // No
      { wch: 25 },  // Nama Objek
      { wch: 18 },  // Latitude
      { wch: 18 },  // Longitude
      { wch: 20 },  // Jarak Terdekat (m)
      { wch: 25 },  // Pole Terdekat
    ];
    ws['!cols'] = summaryColsWidth;
    return;
  }

  // fallthrough to standard segment columns layout for dropwire sheet, but skipping DMS and Custom columns width additions because isDropwireOnly is true

  const summaryColsWidth = [
    { wch: 5 },   // No
    { wch: 25 },  // Nama Objek
    { wch: 18 },  // Total Panjang
    { wch: 18 },  // Segmen Terakhir
  ];

  if (!isDropwireOnly) {
    for (let i = 0; i < maxSegments; i++) {
      summaryColsWidth.push({ wch: 15 }); // Segmen X
    }
  }

  if (config.includeDms && !isDropwireOnly) {
    summaryColsWidth.push({ wch: 25 }); // DMS Lat
    summaryColsWidth.push({ wch: 25 }); // DMS Lng
  }
  if (!isDropwireOnly) {
    config.customColumns.forEach(() => {
      summaryColsWidth.push({ wch: 18 }); // Custom Extended keys
    });
    if (config.includeFlatCoords) {
      summaryColsWidth.push({ wch: 40 }); // Flat coordinates list
    }
  } else {
    // Dropwire sheet exclusive extra columns width
    summaryColsWidth.push({ wch: 25 }); // Koordinat Ujung
    summaryColsWidth.push({ wch: 20 }); // HP_ID
  }
  ws['!cols'] = summaryColsWidth;
}

/**
 * Generates a workbook sheet containing high-level stats/volume reports of all objects.
 */
export function createVolumeSheet(
  placemarks: KMLPlacemark[],
  sheetNameMap: Record<string, string>
) {
  // Group by folder path (the cleaned sheet names)
  const folderStats: Record<string, {
    totalCount: number;
    totalLength: number;
  }> = {};

  // Initialize folders in pre-generated order to maintain consistent layout
  const usedFolders = new Set<string>();
  for (const pm of placemarks) {
    const origFolder = pm.folderPath ? pm.folderPath.trim() : 'Utama';
    const folderLabel = sheetNameMap[origFolder] || origFolder;
    usedFolders.add(folderLabel);
  }

  for (const label of usedFolders) {
    folderStats[label] = {
      totalCount: 0,
      totalLength: 0
    };
  }

  for (const pm of placemarks) {
    const geom = pm.geometryType;
    const len = calculatePlacemarkLength(pm.coordinates, pm.geometryType, pm.name);
    
    const origFolder = pm.folderPath ? pm.folderPath.trim() : 'Utama';
    const folderLabel = sheetNameMap[origFolder] || origFolder;

    const stat = folderStats[folderLabel];
    if (stat) {
      stat.totalCount++;
      if (geom === 'LineString' || geom === 'Polygon') {
        stat.totalLength += len;
      }
    }
  }

  const aoa: any[][] = [];

  // Table Header exactly matching user screenshot
  aoa.push(["No", "Nama Sheet Folder", "Total Objek", "Total Panjang (m)"]);

  let fIndex = 1;
  const labelsKeys = Array.from(usedFolders);
  for (const label of labelsKeys) {
    const s = folderStats[label];
    aoa.push([
      fIndex++,
      label,
      s.totalCount,
      s.totalLength > 0 ? Number(s.totalLength.toFixed(1)) : "-"
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  return ws;
}

/**
 * Creates the "TEMUAN" sheet content.
 */
export function createTemuanSheet(
  placemarks: KMLPlacemark[],
  tolerance: number = 1.0,
  sheetNameMap: Record<string, string>
): XLSX.WorkSheet {
  const circles = placemarks.filter(pm => {
    const isPoint = pm.geometryType === 'Point' || pm.coordinates.length === 1;
    if (!isPoint || pm.coordinates.length === 0) return false;
    const iconLower = pm.styleIcon ? pm.styleIcon.toLowerCase() : '';
    return iconLower.includes('placemark_circle') || 
           iconLower.includes('placemark_circle.png') ||
           iconLower.includes('/b.png') ||
           iconLower === 'b.png' ||
           iconLower.endsWith('b.png');
  });

  const dropwires = placemarks.filter(pm => {
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
    let endpointType: 'Awal' | 'Akhir' | null = null;

    for (const dw of dropwires) {
      if (dw.coordinates.length < 2) continue;
      const startPt = dw.coordinates[0];
      const endPt = dw.coordinates[dw.coordinates.length - 1];

      const distToStart = calculateDistance(coord, startPt);
      const distToEnd = calculateDistance(coord, endPt);

      if (distToStart < minDistance) {
        minDistance = distToStart;
        nearestDropwire = dw;
        endpointType = 'Awal';
      }
      if (distToEnd < minDistance) {
        minDistance = distToEnd;
        nearestDropwire = dw;
        endpointType = 'Akhir';
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
  const isAllConnected = unconnectedCircles.length === 0;
  const isValid = isCountMatch && isAllConnected;

  const aoa: any[][] = [];

  // Detailed Table Header
  aoa.push([
    "No", 
    "Homepass Id", 
    "Latitude", 
    "Longitude", 
    "Status Koneksi", 
    "Jarak Terdekat ke Ujung (m)"
  ]);

  circleDetails.forEach((detail, index) => {
    const circle = detail.circle;
    const coord = circle.coordinates[0];
    const hpId = getHomepassValue(circle);
    const hpDisplayName = (hpId && hpId !== '-') ? hpId : (circle.name || `Placemark #${index + 1}`);

    aoa.push([
      index + 1,
      hpDisplayName,
      coord ? coord.lat : "-",
      coord ? coord.lng : "-",
      detail.isConnected ? "TERHUBUNG" : "TIDAK TERHUBUNG",
      detail.minDistance !== null ? Number(detail.minDistance.toFixed(2)) : "-"
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  return ws;
}

/**
 * Generates an Excel file from KML Placemarks.
 */
export function exportToExcel(
  placemarks: KMLPlacemark[],
  config: ExporterConfig,
  fileName: string
) {
  const finalFilename = fileName.toLowerCase().endsWith('.xlsx') 
    ? fileName 
    : `${fileName.replace(/\.(kml|kmz)$/i, '')}.xlsx`;

  const wb = XLSX.utils.book_new();
  const usedSheetNames = new Set<string>();

  // Group placemarks by folder
  const folderGroups: Record<string, KMLPlacemark[]> = {};
  for (const pm of placemarks) {
    const fKey = pm.folderPath ? pm.folderPath.trim() : 'Utama';
    if (!folderGroups[fKey]) {
      folderGroups[fKey] = [];
    }
    folderGroups[fKey].push(pm);
  }

  const folderKeys = Object.keys(folderGroups);

  // Pre-generate and map sheet names so the KML folder name column matches 100% with the Excel sheet name
  const sheetNameMap: Record<string, string> = {};
  for (const folderName of folderKeys) {
    if (folderName === 'Utama' && folderKeys.length === 1) {
      // If there's no folders (only the fallback Utama), name the sheet tab exactly after the file name
      const baseFile = fileName.replace(/\.(kml|kmz)$/i, '').trim() || 'Data KML';
      sheetNameMap[folderName] = getUniqueSheetName(baseFile, usedSheetNames);
    } else {
      sheetNameMap[folderName] = getUniqueSheetName(folderName, usedSheetNames);
    }
  }

  // Create and append the "Volume" sheet as the first tab in the workbook
  const volumeSheetName = "Volume";
  usedSheetNames.add(volumeSheetName.toLowerCase());
  const wsVolume = createVolumeSheet(placemarks, sheetNameMap);
  wsVolume['!cols'] = [
    { wch: 6 },   // No
    { wch: 25 },  // Nama Sheet Folder
    { wch: 15 },  // Total Objek
    { wch: 22 },  // Total Panjang (m)
  ];
  XLSX.utils.book_append_sheet(wb, wsVolume, volumeSheetName);

  // 1.5 Create and append the "TEMUAN" sheet as the second tab in the workbook
  const temuanSheetName = "TEMUAN";
  usedSheetNames.add(temuanSheetName.toLowerCase());
  const snappingTolerance = config.tolerance !== undefined ? config.tolerance : 1.0;
  const wsTemuan = createTemuanSheet(placemarks, snappingTolerance, sheetNameMap);
  wsTemuan['!cols'] = [
    { wch: 6 },   // No
    { wch: 30 },  // Homepass Id
    { wch: 15 },  // Lat
    { wch: 15 },  // Lng
    { wch: 18 },  // Status Koneksi
    { wch: 28 }   // Jarak Ujung (m)
  ];
  XLSX.utils.book_append_sheet(wb, wsTemuan, temuanSheetName);

  // Prepare individual sheets for each folder path (one sheet per KML folder)
  if (folderKeys.length > 0) {
    for (const folderName of folderKeys) {
      const pmList = folderGroups[folderName];
      const folderRows = createPlacemarkRows(pmList, config, sheetNameMap, placemarks);
      
      const isDropwireOnly = pmList.length > 0 && pmList.some(pm => pm.name && pm.name.toUpperCase().includes('DROPWIRE'));
      const allPoints = pmList.length > 0 && pmList.every(pm => pm.geometryType === 'Point' || pm.coordinates.length <= 1);
      let sheetMaxSegments = 0;
      if (!isDropwireOnly && !allPoints) {
        pmList.forEach(pm => {
          if (pm.geometryType === 'LineString' && pm.coordinates.length > 1) {
            const segs = pm.coordinates.length - 1;
            if (segs > sheetMaxSegments) {
              sheetMaxSegments = segs;
            }
          }
        });
      }

      const wsFolder = XLSX.utils.json_to_sheet(folderRows);
      const isHpList = isHomepassList(pmList);
      const isCableList = false;
      const isFatListVal = isFatList(pmList);
      const isFatAreaListVal = isFatAreaList(pmList);
      setSheetColumnWidths(wsFolder, config, sheetMaxSegments, isDropwireOnly, allPoints, isHpList, isCableList, isFatListVal, isFatAreaListVal);

      const folderSheetName = sheetNameMap[folderName];
      XLSX.utils.book_append_sheet(wb, wsFolder, folderSheetName);
    }
  }

  // 3. Prepare Detailed Vertices Sheet if requested and applicable
  // Skip Sheet 2 if any placemarks are dropwires, as requested to remove other data sheets
  // Also skip Sheet 2 if the file contains only points as coordinates are already fully present
  const allPlacemarksAreDropwires = placemarks.length > 0 && placemarks.some(pm => pm.name && pm.name.toUpperCase().includes('DROPWIRE'));
  const fileIsAllPoints = placemarks.length > 0 && placemarks.every(pm => pm.geometryType === 'Point' || pm.coordinates.length <= 1);
  if (config.exportVertexSheet && !allPlacemarksAreDropwires && !fileIsAllPoints) {
    const detailRows: Record<string, any>[] = [];
    let rowCounter = 1;

    placemarks.forEach(pm => {
      // Don't clutter details with point files since they only have 1 point which is already in summary
      // But we still include it if elements are LineStrings or Polygons
      const itemCoords = pm.coordinates;
      itemCoords.forEach((coord, vIndex) => {
        const origFolder = pm.folderPath ? pm.folderPath.trim() : 'Utama';
        const folderValue = sheetNameMap[origFolder] || origFolder;

        const isNotLast = vIndex < itemCoords.length - 1;
        const segDist = isNotLast ? calculateDistance(coord, itemCoords[vIndex + 1]) : 0;

        const detailRow: Record<string, any> = {
          'No Baris': rowCounter++,
          'Nama Objek KML': pm.name,
          'Simpul nomor (%)': vIndex + 1,
          'Latitude (Lat)': coord.lat,
          'Longitude (Lng)': coord.lng,
          'Ketinggian (Altitude)': coord.alt !== null ? coord.alt : '-',
          'Panjang Segmen ke-Berikutnya (m)': isNotLast ? Number(segDist.toFixed(2)) : '-',
        };

        if (config.includeDms) {
          detailRow['DMS Latitude'] = decimalToDms(coord.lat, true);
          detailRow['DMS Longitude'] = decimalToDms(coord.lng, false);
        }

        detailRows.push(detailRow);
      });
    });

    if (detailRows.length > 0) {
      const wsDetail = XLSX.utils.json_to_sheet(detailRows);
      wsDetail['!cols'] = [
        { wch: 10 }, // No Baris
        { wch: 25 }, // Nama Objek KML
        { wch: 15 }, // Simpul nomor
        { wch: 18 }, // Latitude
        { wch: 18 }, // Longitude
        { wch: 18 }, // Altitude
        { wch: 30 }, // Panjang Segmen ke-Berikutnya (m)
        ...(config.includeDms ? [{ wch: 25 }, { wch: 25 }] : []) // DMS columns
      ];
      const detailsSheetName = getUniqueSheetName('Daftar Koordinat Rinci', usedSheetNames);
      XLSX.utils.book_append_sheet(wb, wsDetail, detailsSheetName);
    }
  }

  // 3.5 Apply "Left (Indent)" style to all cells in all sheets of the workbook
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (ws) {
      applyLeftIndentStyleToSheet(ws);
    }
  }

  // 4. Write Excel file
  XLSX.writeFile(wb, finalFilename);
}

/**
 * Formats all cells in a sheet to use the "Left (Indent)" style: Horizontal Left with 1-level Indent.
 */
function applyLeftIndentStyleToSheet(ws: XLSX.WorkSheet) {
  for (const key in ws) {
    if (key.startsWith('!')) continue;
    const cell = ws[key];
    if (cell && typeof cell === 'object') {
      cell.s = {
        alignment: {
          horizontal: 'left',
          indent: 1
        }
      };
    }
  }
}
