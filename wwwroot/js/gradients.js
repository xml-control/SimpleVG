/**
 * SimpleVG - Gradient Manager
 * Dynamically creates and updates Linear & Radial <linearGradient> and <radialGradient> definitions in <defs>
 */

class GradientManager {
  constructor(defsElement) {
    this.defs = defsElement;
    this.counter = 1;
  }

  createLinearGradient(colorStops, angle = 90) {
    const id = `grad-linear-${this.counter++}`;
    const grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
    grad.setAttribute("id", id);

    // Calculate x1, y1, x2, y2 from angle
    const angleRad = (angle * Math.PI) / 180;
    const x1 = Math.round(50 - Math.cos(angleRad) * 50);
    const y1 = Math.round(50 - Math.sin(angleRad) * 50);
    const x2 = Math.round(50 + Math.cos(angleRad) * 50);
    const y2 = Math.round(50 + Math.sin(angleRad) * 50);

    grad.setAttribute("x1", `${x1}%`);
    grad.setAttribute("y1", `${y1}%`);
    grad.setAttribute("x2", `${x2}%`);
    grad.setAttribute("y2", `${y2}%`);

    colorStops.forEach(stopInfo => {
      const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
      stop.setAttribute("offset", stopInfo.offset);
      stop.setAttribute("stop-color", stopInfo.color);
      if (stopInfo.opacity !== undefined) {
        stop.setAttribute("stop-opacity", stopInfo.opacity);
      }
      grad.appendChild(stop);
    });

    this.defs.appendChild(grad);
    return `url(#${id})`;
  }

  createRadialGradient(colorStops, cx = "35%", cy = "35%", r = "65%") {
    const id = `grad-radial-${this.counter++}`;
    const grad = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
    grad.setAttribute("id", id);
    grad.setAttribute("cx", cx);
    grad.setAttribute("cy", cy);
    grad.setAttribute("r", r);

    colorStops.forEach(stopInfo => {
      const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
      stop.setAttribute("offset", stopInfo.offset);
      stop.setAttribute("stop-color", stopInfo.color);
      if (stopInfo.opacity !== undefined) {
        stop.setAttribute("stop-opacity", stopInfo.opacity);
      }
      grad.appendChild(stop);
    });

    this.defs.appendChild(grad);
    return `url(#${id})`;
  }

  getPresetStops(presetName) {
    switch (presetName) {
      case 'metal':
        return [
          { offset: "0%", color: "#4A5568" },
          { offset: "35%", color: "#E2E8F0" },
          { offset: "70%", color: "#718096" },
          { offset: "100%", color: "#2D3748" }
        ];
      case 'copper':
        return [
          { offset: "0%", color: "#7B341E" },
          { offset: "40%", color: "#FBD38D" },
          { offset: "80%", color: "#C05621" },
          { offset: "100%", color: "#4A1D0D" }
        ];
      case 'gold':
        return [
          { offset: "0%", color: "#744210" },
          { offset: "35%", color: "#FEFCBF" },
          { offset: "75%", color: "#D69E2E" },
          { offset: "100%", color: "#521B02" }
        ];
      case 'led-green':
        return [
          { offset: "0%", color: "#9AE6B4" },
          { offset: "45%", color: "#38A169" },
          { offset: "100%", color: "#1C4532" }
        ];
      case 'led-red':
        return [
          { offset: "0%", color: "#FEB2B2" },
          { offset: "45%", color: "#E53E3E" },
          { offset: "100%", color: "#742A2A" }
        ];
      case 'led-blue':
        return [
          { offset: "0%", color: "#90CDF4" },
          { offset: "45%", color: "#3182CE" },
          { offset: "100%", color: "#1A365D" }
        ];
      case 'led-amber':
        return [
          { offset: "0%", color: "#FBD38D" },
          { offset: "45%", color: "#DD6B20" },
          { offset: "100%", color: "#7B341E" }
        ];
      case 'led-off':
        return [
          { offset: "0%", color: "#EDF2F7" },
          { offset: "45%", color: "#A0AEC0" },
          { offset: "100%", color: "#2D3748" }
        ];
      case 'liquid-water':
        return [
          { offset: "0%", color: "#EBF8FF" },
          { offset: "40%", color: "#319795" },
          { offset: "80%", color: "#2B6CB0" },
          { offset: "100%", color: "#1A365D" }
        ];
      default:
        return [
          { offset: "0%", color: "#FFFFFF" },
          { offset: "100%", color: "#000000" }
        ];
    }
  }
}
