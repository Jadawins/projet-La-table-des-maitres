// ColorWheelPicker.js — HSL color wheel component for custom palette selection
import { hslToHex, generatePaletteFromColor } from "../../utils/color-utils.js";

const WHEEL_SIZE = 200;
const SLIDER_WIDTH = 22;

/**
 * Fast HSL → RGB conversion (inline, no import needed for canvas drawing)
 */
function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/**
 * Draw the HSL color wheel on a canvas element.
 * Hue = angular axis, Saturation = radial axis, Lightness fixed at 50%.
 */
function drawWheel(canvas) {
  const ctx = canvas.getContext("2d");
  const cx = WHEEL_SIZE / 2;
  const cy = WHEEL_SIZE / 2;
  const radius = WHEEL_SIZE / 2 - 1;
  const imageData = ctx.createImageData(WHEEL_SIZE, WHEEL_SIZE);

  for (let y = 0; y < WHEEL_SIZE; y++) {
    for (let x = 0; x < WHEEL_SIZE; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * WHEEL_SIZE + x) * 4;

      if (dist > radius) {
        imageData.data[idx + 3] = 0;
        continue;
      }

      const hue = ((Math.atan2(dy, dx) / (2 * Math.PI)) * 360 + 360) % 360;
      const sat = (dist / radius) * 100;
      const [r, g, b] = hslToRgb(hue, sat, 50);

      imageData.data[idx] = r;
      imageData.data[idx + 1] = g;
      imageData.data[idx + 2] = b;
      imageData.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Draw the lightness slider (white → hue color → black).
 */
function drawSlider(canvas, hue, sat) {
  const ctx = canvas.getContext("2d");
  const h = canvas.height;
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.5, `hsl(${hue}, ${sat}%, 50%)`);
  gradient.addColorStop(1, "#000000");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SLIDER_WIDTH, h);
}

/**
 * Get position on wheel from mouse/touch event.
 */
function getWheelPos(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const cx = WHEEL_SIZE / 2;
  const cy = WHEEL_SIZE / 2;
  const radius = WHEEL_SIZE / 2 - 1;
  const touch = e.touches ? e.touches[0] : e;
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.min(Math.sqrt(dx * dx + dy * dy), radius);
  const hue = ((Math.atan2(dy, dx) / (2 * Math.PI)) * 360 + 360) % 360;
  const sat = (dist / radius) * 100;
  return { hue, sat };
}

/**
 * Get lightness value from mouse/touch event on the slider.
 */
function getSliderLit(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : e;
  const y = Math.max(0, Math.min(canvas.height, touch.clientY - rect.top));
  return (1 - y / canvas.height) * 100;
}

export const ColorWheelPicker = {
  oninit(vnode) {
    vnode.state.hue = 30;
    vnode.state.sat = 80;
    vnode.state.lit = 50;
    vnode.state.dragging = null; // "wheel" | "slider" | null
    vnode.state.wheelCanvas = null;
    vnode.state.sliderCanvas = null;
  },

  oncreate(vnode) {
    const s = vnode.state;
    s._onMouseMove = (e) => {
      if (!s.dragging) return;
      if (s.dragging === "wheel" && s.wheelCanvas) {
        const pos = getWheelPos(e, s.wheelCanvas);
        s.hue = pos.hue;
        s.sat = pos.sat;
      } else if (s.dragging === "slider" && s.sliderCanvas) {
        s.lit = getSliderLit(e, s.sliderCanvas);
      }
      m.redraw();
    };
    s._onMouseUp = () => {
      if (s.dragging) {
        s.dragging = null;
        m.redraw();
      }
    };
    document.addEventListener("mousemove", s._onMouseMove);
    document.addEventListener("mouseup", s._onMouseUp);
  },

  onremove(vnode) {
    document.removeEventListener("mousemove", vnode.state._onMouseMove);
    document.removeEventListener("mouseup", vnode.state._onMouseUp);
  },

  view(vnode) {
    const { basePalette, onSelect } = vnode.attrs;
    const s = vnode.state;
    const { hue, sat, lit } = s;

    const pickedHex = hslToHex(hue, sat, lit);
    const palette = generatePaletteFromColor(pickedHex, basePalette);

    // Cursor position on wheel
    const cx = WHEEL_SIZE / 2;
    const cy = WHEEL_SIZE / 2;
    const radius = WHEEL_SIZE / 2 - 1;
    const wx = cx + (sat / 100) * radius * Math.cos((hue / 360) * 2 * Math.PI);
    const wy = cy + (sat / 100) * radius * Math.sin((hue / 360) * 2 * Math.PI);

    // Cursor position on slider
    const sliderH = WHEEL_SIZE;
    const sy = (1 - lit / 100) * sliderH;

    return m(".color-wheel-picker", [
      m(".color-wheel-controls", [
        // Wheel
        m(".color-wheel-wrap", [
          m("canvas.color-wheel-canvas", {
            width: WHEEL_SIZE,
            height: WHEEL_SIZE,
            oncreate: (cv) => {
              s.wheelCanvas = cv.dom;
              drawWheel(cv.dom);
            },
            onmousedown: (e) => {
              e.preventDefault();
              s.dragging = "wheel";
              const pos = getWheelPos(e, s.wheelCanvas);
              s.hue = pos.hue;
              s.sat = pos.sat;
              m.redraw();
            },
            ontouchstart: (e) => {
              e.preventDefault();
              s.dragging = "wheel";
              const pos = getWheelPos(e, s.wheelCanvas);
              s.hue = pos.hue;
              s.sat = pos.sat;
              m.redraw();
            },
            ontouchmove: (e) => {
              e.preventDefault();
              if (s.dragging !== "wheel") return;
              const pos = getWheelPos(e, s.wheelCanvas);
              s.hue = pos.hue;
              s.sat = pos.sat;
              m.redraw();
            },
            ontouchend: () => { s.dragging = null; },
          }),
          // Wheel cursor dot
          m(".wheel-cursor", {
            style: {
              left: `${wx - 7}px`,
              top: `${wy - 7}px`,
            },
          }),
        ]),

        // Lightness slider
        m(".lightness-slider-wrap", [
          m("canvas.lightness-slider-canvas", {
            width: SLIDER_WIDTH,
            height: sliderH,
            oncreate: (cv) => {
              s.sliderCanvas = cv.dom;
              drawSlider(cv.dom, hue, sat);
            },
            onupdate: (cv) => {
              drawSlider(cv.dom, hue, sat);
            },
            onmousedown: (e) => {
              e.preventDefault();
              s.dragging = "slider";
              s.lit = getSliderLit(e, s.sliderCanvas);
              m.redraw();
            },
            ontouchstart: (e) => {
              e.preventDefault();
              s.dragging = "slider";
              s.lit = getSliderLit(e, s.sliderCanvas);
              m.redraw();
            },
            ontouchmove: (e) => {
              e.preventDefault();
              if (s.dragging !== "slider") return;
              s.lit = getSliderLit(e, s.sliderCanvas);
              m.redraw();
            },
            ontouchend: () => { s.dragging = null; },
          }),
          // Slider cursor line
          m(".slider-cursor", {
            style: { top: `${sy - 4}px` },
          }),
        ]),
      ]),

      // Preview: picked color swatch + generated palette
      m(".custom-palette-preview", [
        m(".picked-color-display", [
          m(".picked-color-swatch", {
            style: { backgroundColor: pickedHex },
          }),
          m("span.picked-color-hex", pickedHex),
        ]),
        m(".palette-swatch.custom-palette-swatch",
          palette.map((color) =>
            m("span", { style: { backgroundColor: color } }),
          ),
        ),
      ]),

      // Apply button
      m("button.button.is-primary.is-small.mt-2", {
        onclick: (e) => {
          e.stopPropagation();
          onSelect(palette);
        },
      }, "Appliquer"),
    ]);
  },
};
