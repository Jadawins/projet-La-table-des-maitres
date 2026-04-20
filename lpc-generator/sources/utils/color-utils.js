// Color utilities for HSL/hex conversion and palette generation

/**
 * Convert hex color to HSL
 * @param {string} hex - Hex color (e.g., "#cc8844")
 * @returns {[number, number, number]} [hue (0-360), saturation (0-100), lightness (0-100)]
 */
export function hexToHSL(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 50];
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

/**
 * Convert HSL to hex color
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {string} Hex color (e.g., "#cc8844")
 */
export function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/**
 * Generate a palette of N colors from a picked color, using the source palette's
 * lightness distribution as reference.
 *
 * The algorithm preserves the relative lightness spread of the original palette
 * (dark shadows → midtones → highlights) while applying the user's chosen hue
 * and saturation.
 *
 * @param {string} pickedHex - The color chosen by the user
 * @param {string[]} sourcePalette - Base source palette (reference for N shades + spread)
 * @returns {string[]} Generated palette of same length as sourcePalette
 */
export function generatePaletteFromColor(pickedHex, sourcePalette) {
  if (!sourcePalette || sourcePalette.length === 0) {
    return [pickedHex];
  }

  const [pH, pS, pL] = hexToHSL(pickedHex);
  const sourceHSL = sourcePalette.map(hexToHSL);

  const lValues = sourceHSL.map(([, , l]) => l);
  const lMin = Math.min(...lValues);
  const lMax = Math.max(...lValues);
  const lRange = lMax - lMin;

  return sourceHSL.map(([, , srcL]) => {
    // Map src lightness to new range centered around picked lightness
    const normalized = lRange > 0 ? (srcL - lMin) / lRange : 0.5;
    const newL = pL - lRange / 2 + normalized * lRange;
    return hslToHex(pH, pS, Math.max(2, Math.min(97, newL)));
  });
}
