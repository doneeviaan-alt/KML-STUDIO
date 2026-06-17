import JSZip from 'jszip';

export interface Coordinate {
  lng: number;
  lat: number;
  alt: number | null;
}

export interface KMLPlacemark {
  id: string;
  name: string;
  description: string;
  geometryType: 'Point' | 'LineString' | 'Polygon' | 'MultiGeometry' | 'Unknown';
  coordinates: Coordinate[];
  extendedData: Record<string, string>;
  folderPath: string;
  styleColor?: string;
  styleWidth?: number;
  styleIcon?: string;
}

export interface ParseResult {
  fileName: string;
  fileSize: number;
  placemarks: KMLPlacemark[];
  extendedKeys: string[];
  folders: string[];
}

/**
 * Parses coordinates string from KML coordinates tag.
 * Standard format is longitude,latitude,altitude separated by whitespace.
 */
function parseCoordinatesString(coordStr: string): Coordinate[] {
  const result: Coordinate[] = [];
  const coords = coordStr.trim().split(/\s+/);
  for (const coord of coords) {
    if (!coord) continue;
    const parts = coord.split(',');
    if (parts.length >= 2) {
      const lng = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      const alt = parts.length >= 3 ? parseFloat(parts[2]) : null;
      if (!isNaN(lng) && !isNaN(lat)) {
        result.push({
          lng,
          lat,
          alt: alt !== null && !isNaN(alt) ? alt : null,
        });
      }
    }
  }
  return result;
}

/**
 * Traverses upwards to build parent folder hierarchy path.
 */
function getFolderPath(node: Node): string {
  const folders: string[] = [];
  let parent = node.parentNode;
  while (parent) {
    if (parent.nodeName === 'Folder') {
      const nameNode = Array.from(parent.childNodes).find(child => child.nodeName === 'name');
      if (nameNode && nameNode.textContent) {
        const folderName = nameNode.textContent.trim();
        if (folderName && !folders.includes(folderName)) {
          folders.unshift(folderName);
        }
      }
    }
    parent = parent.parentNode;
  }
  return folders.join(' > ');
}

/**
 * Parses custom schema or ExtendedData tags.
 */
function extractExtendedData(placemarkNode: Element): Record<string, string> {
  const extendedData: Record<string, string> = {};
  const extendedNode = placemarkNode.getElementsByTagName('ExtendedData')[0];
  if (extendedNode) {
    // 1. Check standard <Data name="Key"><value>Value</value></Data>
    const dataNodes = extendedNode.getElementsByTagName('Data');
    for (let i = 0; i < dataNodes.length; i++) {
      const node = dataNodes[i];
      const nameVal = node.getAttribute('name');
      if (nameVal) {
        // Filter out system supporting metadata from mapmakers (e.g. com_exlyo_mapmarker_...)
        const lowerName = nameVal.toLowerCase();
        const isSupportingMeta = lowerName.startsWith('com_exlyo') || 
                                 lowerName.startsWith('com.exlyo') ||
                                 lowerName.includes('mapmarker');
        if (isSupportingMeta) continue;

        const valueNode = node.getElementsByTagName('value')[0];
        if (valueNode && valueNode.textContent) {
          extendedData[nameVal] = valueNode.textContent.trim();
        }
      }
    }
    // 2. Check <SimpleData name="Key">Value</SimpleData> (used in SchemaData)
    const simpleDataNodes = extendedNode.getElementsByTagName('SimpleData');
    for (let i = 0; i < simpleDataNodes.length; i++) {
      const node = simpleDataNodes[i];
      const nameVal = node.getAttribute('name');
      if (nameVal) {
        // Filter out system supporting metadata from mapmakers (e.g. com_exlyo_mapmarker_...)
        const lowerName = nameVal.toLowerCase();
        const isSupportingMeta = lowerName.startsWith('com_exlyo') || 
                                 lowerName.startsWith('com.exlyo') ||
                                 lowerName.includes('mapmarker');
        if (isSupportingMeta) continue;

        if (node.textContent) {
          extendedData[nameVal] = node.textContent.trim();
        }
      }
    }
  } else {
    // Fallback: search for other tags inside the placemark that aren't metadata
    // like standard attributes
  }
  return extendedData;
}

/**
 * Decodes KML color format (aabbggrr hex) to RGB(A) or Hex.
 */
function parseKmlColor(kmlColor: string): string {
  const color = kmlColor.trim();
  if (color.length === 8) {
    // format is aabbggrr
    const a = color.substring(0, 2);
    const b = color.substring(2, 4);
    const g = color.substring(4, 6);
    const r = color.substring(6, 8);
    const alpha = (parseInt(a, 16) / 255).toFixed(2);
    return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${alpha})`;
  } else if (color.length === 6) {
    // bbggrr format
    const b = color.substring(0, 2);
    const g = color.substring(2, 4);
    const r = color.substring(4, 6);
    return `rgb(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)})`;
  }
  return '';
}

/**
 * Helper to find a style element by ID, resolving any StyleMap references inside KML to their normal style definition.
 */
function findStyleById(doc: Document, styleId: string): Element | null {
  const styles = doc.getElementsByTagName('Style');
  for (let i = 0; i < styles.length; i++) {
    if (styles[i].getAttribute('id') === styleId) {
      return styles[i];
    }
  }

  const styleMaps = doc.getElementsByTagName('StyleMap');
  for (let i = 0; i < styleMaps.length; i++) {
    if (styleMaps[i].getAttribute('id') === styleId) {
      const pairs = styleMaps[i].getElementsByTagName('Pair');
      for (let j = 0; j < pairs.length; j++) {
        const keyNode = pairs[j].getElementsByTagName('key')[0];
        if (keyNode && keyNode.textContent?.trim() === 'normal') {
          const innerStyleUrlNode = pairs[j].getElementsByTagName('styleUrl')[0];
          if (innerStyleUrlNode && innerStyleUrlNode.textContent) {
            const innerStyleId = innerStyleUrlNode.textContent.trim().replace(/^#/, '');
            const resolved = findStyleById(doc, innerStyleId);
            if (resolved) return resolved;
          }
        }
      }
      // Fallback to first StyleUrl
      const innerStyleUrlNode = styleMaps[i].getElementsByTagName('styleUrl')[0];
      if (innerStyleUrlNode && innerStyleUrlNode.textContent) {
        const innerStyleId = innerStyleUrlNode.textContent.trim().replace(/^#/, '');
        const resolved = findStyleById(doc, innerStyleId);
        if (resolved) return resolved;
      }
    }
  }

  return null;
}

/**
 * Helper to resolve styles in KML to color/width.
 */
function extractStyleColor(placemarkNode: Element, doc: Document): { color?: string; width?: number } {
  // If the placemark contains local style elements
  const styleNode = placemarkNode.getElementsByTagName('Style')[0];
  if (styleNode) {
    const lineStyle = styleNode.getElementsByTagName('LineStyle')[0];
    const polyStyle = styleNode.getElementsByTagName('PolyStyle')[0];
    
    let color: string | undefined;
    let width: number | undefined;

    if (lineStyle) {
      const colorNode = lineStyle.getElementsByTagName('color')[0];
      const widthNode = lineStyle.getElementsByTagName('width')[0];
      if (colorNode && colorNode.textContent) color = parseKmlColor(colorNode.textContent);
      if (widthNode && widthNode.textContent) width = parseFloat(widthNode.textContent);
    }
    if (polyStyle && !color) {
      const colorNode = polyStyle.getElementsByTagName('color')[0];
      if (colorNode && colorNode.textContent) color = parseKmlColor(colorNode.textContent);
    }
    if (color || width) return { color, width };
  }

  // Look for styleUrl reference
  const styleUrlNode = placemarkNode.getElementsByTagName('styleUrl')[0];
  if (styleUrlNode && styleUrlNode.textContent) {
    const styleId = styleUrlNode.textContent.trim().replace(/^#/, '');
    if (styleId) {
      const s = findStyleById(doc, styleId);
      if (s) {
        const lineStyle = s.getElementsByTagName('LineStyle')[0];
        const polyStyle = s.getElementsByTagName('PolyStyle')[0];
        let color: string | undefined;
        let width: number | undefined;
        
        if (lineStyle) {
          const colorNode = lineStyle.getElementsByTagName('color')[0];
          const widthNode = lineStyle.getElementsByTagName('width')[0];
          if (colorNode && colorNode.textContent) color = parseKmlColor(colorNode.textContent);
          if (widthNode && widthNode.textContent) width = parseFloat(widthNode.textContent);
        }
        if (polyStyle && !color) {
          const colorNode = polyStyle.getElementsByTagName('color')[0];
          if (colorNode && colorNode.textContent) color = parseKmlColor(colorNode.textContent);
        }
        if (color || width) return { color, width };
      }
    }
  }

  return {};
}

/**
 * Helper to resolve Icon href in KML styles.
 */
function extractStyleIcon(placemarkNode: Element, doc: Document): string | undefined {
  // Check local style
  const styleNode = placemarkNode.getElementsByTagName('Style')[0];
  if (styleNode) {
    const iconStyle = styleNode.getElementsByTagName('IconStyle')[0];
    if (iconStyle) {
      const icon = iconStyle.getElementsByTagName('Icon')[0];
      if (icon) {
        const href = icon.getElementsByTagName('href')[0];
        if (href && href.textContent) {
          return href.textContent.trim();
        }
      }
    }
  }

  // Check styleUrl style
  const styleUrlNode = placemarkNode.getElementsByTagName('styleUrl')[0];
  if (styleUrlNode && styleUrlNode.textContent) {
    const styleId = styleUrlNode.textContent.trim().replace(/^#/, '');
    if (styleId) {
      const s = findStyleById(doc, styleId);
      if (s) {
        const iconStyle = s.getElementsByTagName('IconStyle')[0];
        if (iconStyle) {
          const icon = iconStyle.getElementsByTagName('Icon')[0];
          if (icon) {
            const href = icon.getElementsByTagName('href')[0];
            if (href && href.textContent) {
              return href.textContent.trim();
            }
          }
        }
      }
    }
  }

  return undefined;
}

/**
 * Extracts coordinates and identifies type of geometry.
 */
function extractGeometry(placemarkNode: Element): {
  type: 'Point' | 'LineString' | 'Polygon' | 'MultiGeometry' | 'Unknown';
  coordinates: Coordinate[];
} {
  // Check for MultiGeometry first
  const multiNode = placemarkNode.getElementsByTagName('MultiGeometry')[0];
  if (multiNode) {
    const coords: Coordinate[] = [];
    const coordNodes = multiNode.getElementsByTagName('coordinates');
    for (let i = 0; i < coordNodes.length; i++) {
      const text = coordNodes[i].textContent || '';
      coords.push(...parseCoordinatesString(text));
    }
    return {
      type: 'MultiGeometry',
      coordinates: coords
    };
  }

  // Check Polygon
  const polygonNode = placemarkNode.getElementsByTagName('Polygon')[0];
  if (polygonNode) {
    const outerNode = polygonNode.getElementsByTagName('outerBoundaryIs')[0];
    if (outerNode) {
      const coordNode = outerNode.getElementsByTagName('coordinates')[0];
      if (coordNode && coordNode.textContent) {
        return {
          type: 'Polygon',
          coordinates: parseCoordinatesString(coordNode.textContent)
        };
      }
    }
    const coordNodes = polygonNode.getElementsByTagName('coordinates');
    if (coordNodes.length > 0 && coordNodes[0].textContent) {
      return {
        type: 'Polygon',
        coordinates: parseCoordinatesString(coordNodes[0].textContent)
      };
    }
  }

  // Check LineString
  const lineNode = placemarkNode.getElementsByTagName('LineString')[0];
  if (lineNode) {
    const coordNode = lineNode.getElementsByTagName('coordinates')[0];
    if (coordNode && coordNode.textContent) {
      return {
        type: 'LineString',
        coordinates: parseCoordinatesString(coordNode.textContent)
      };
    }
  }

  // Check Point
  const pointNode = placemarkNode.getElementsByTagName('Point')[0];
  if (pointNode) {
    const coordNode = pointNode.getElementsByTagName('coordinates')[0];
    if (coordNode && coordNode.textContent) {
      return {
        type: 'Point',
        coordinates: parseCoordinatesString(coordNode.textContent)
      };
    }
  }

  // Generic fallback if coordinates exist directly or under some non-standard geometry
  const allCoordNodes = placemarkNode.getElementsByTagName('coordinates');
  if (allCoordNodes.length > 0 && allCoordNodes[0].textContent) {
    return {
      type: 'Unknown',
      coordinates: parseCoordinatesString(allCoordNodes[0].textContent)
    };
  }

  return {
    type: 'Unknown',
    coordinates: []
  };
}

/**
 * Main KML text parser
 */
export function parseKMLText(kmlText: string, fileName: string, fileSize: number): ParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(kmlText, 'text/xml');
  
  // Handlers for parse errors (e.g. malformed xml)
  const parserError = doc.getElementsByTagName('parsererror');
  if (parserError.length > 0) {
    throw new Error('Gagal memproses XML file. Pastikan KML valid dan tidak rusak.');
  }

  const placemarkElements = doc.getElementsByTagName('Placemark');
  const placemarks: KMLPlacemark[] = [];
  const extendedKeySet = new Set<string>();
  const folderSet = new Set<string>();

  for (let i = 0; i < placemarkElements.length; i++) {
    const element = placemarkElements[i];
    
    // Name element
    const nameNode = element.getElementsByTagName('name')[0];
    const name = nameNode?.textContent ? nameNode.textContent.trim() : `Placemark ${i + 1}`;

    // Description element
    const descNode = element.getElementsByTagName('description')[0];
    const description = descNode?.textContent ? descNode.textContent.trim() : '';

    // Folder path hierarchy
    const folderPath = getFolderPath(element);
    if (folderPath) {
      folderSet.add(folderPath);
    }

    // Geometry & coordinates
    const geo = extractGeometry(element);

    // ExtendedData
    const extendedData = extractExtendedData(element);
    Object.keys(extendedData).forEach(key => extendedKeySet.add(key));

    // Style elements
    const style = extractStyleColor(element, doc);
    const styleIcon = extractStyleIcon(element, doc);

    placemarks.push({
      id: `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
      name,
      description,
      geometryType: geo.type,
      coordinates: geo.coordinates,
      extendedData,
      folderPath,
      styleColor: style.color,
      styleWidth: style.width,
      styleIcon
    });
  }

  return {
    fileName,
    fileSize,
    placemarks,
    extendedKeys: Array.from(extendedKeySet),
    folders: Array.from(folderSet)
  };
}

/**
 * Handles KMZ (unzips and parses `.kml` file found inside) or direct KML parser.
 */
export async function parseKMLorKMZ(file: File): Promise<ParseResult> {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  
  if (fileExtension === 'kmz') {
    try {
      const zip = await JSZip.loadAsync(file);
      // Look for the main KML file, usually ending in .kml or doc.kml
      const kmlFiles = Object.keys(zip.files).filter(name => name.toLowerCase().endsWith('.kml'));
      
      if (kmlFiles.length === 0) {
        throw new Error('File KML tidak ditemukan di dalam arsip KMZ.');
      }
      
      // Choose target file
      // Prefer doc.kml if present, otherwise take the first available
      let targetKmlFile = kmlFiles.find(name => name.toLowerCase() === 'doc.kml');
      if (!targetKmlFile) {
        targetKmlFile = kmlFiles[0];
      }
      
      const kmlText = await zip.files[targetKmlFile].async('text');
      return parseKMLText(kmlText, file.name, file.size);
    } catch (err: any) {
      throw new Error(`Gagal membaca file KMZ secara detail: ${err?.message || err}`);
    }
  } else if (fileExtension === 'kml') {
    const kmlText = await file.text();
    return parseKMLText(kmlText, file.name, file.size);
  } else {
    throw new Error('Eskstensi file tidak didukung. Harap unggah file .kml atau .kmz.');
  }
}
