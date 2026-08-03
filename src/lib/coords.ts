// Coordenadas de un campo tipo mapa_coordenadas. La forma canónica en el JSON es un objeto
// `{"lat":…,"lng":…}` (así lo declara la convención), pero el Excel oficial las guarda como texto
// suelto en una celda —`-13.5407619,   -71.923069`— y un usuario puede pegarlas igual a mano.
// Por eso el parser acepta ambas formas y el resto del sistema trabaja siempre con el objeto.
//
// El selector visual vive en components/CampoCoordenadasInput.vue + MapaModal.vue (Leaflet).

export interface Coords {
  lat: number;
  lng: number;
}

function valida(lat: number, lng: number): Coords | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function parseCoords(v?: string | null): Coords | null {
  if (!v) return null;
  const texto = String(v).trim();
  if (texto === '') return null;

  // Forma canónica: JSON
  try {
    const p = JSON.parse(texto);
    if (typeof p?.lat === 'number' && typeof p?.lng === 'number') return valida(p.lat, p.lng);
  } catch {
    /* no era JSON: se intenta como texto suelto */
  }

  // Texto suelto: "lat, lng", "lat lng" o separados por punto y coma. Se toleran espacios de más
  // — la celda del Excel oficial trae varios entre ambos números.
  const nums = texto
    .replace(/[;|]/g, ',')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s !== '' && /^[+-]?[\d.]+$/.test(s));
  if (nums.length >= 2) return valida(Number(nums[0]), Number(nums[1]));

  return null;
}

/** Forma canónica para guardar en el JSON del documento. */
export function serializarCoords(c: Coords): string {
  return JSON.stringify({ lat: c.lat, lng: c.lng });
}

/** Texto plano para la celda del Excel, con el mismo aspecto que trae la plantilla oficial. */
export function coordsATexto(c: Coords): string {
  return `${c.lat}, ${c.lng}`;
}
