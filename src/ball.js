import { Bodies } from "matter-js";
import { buildPermutationTable, noise } from "./utils/noiseUtils.js";

export class Ball {
  constructor(x, y) {
    // Create a ball with a larger radius.
    this.body = Bodies.circle(x, y, 50, {
      restitution: 1.1,
      friction: 0.0,
      density: 0.0001, // Ajout d'une densité très faible pour réduire le poids
      label: "Ball",
    });

    // Initialize noise parameters for the texture
    this.radius = 50;
    this.noiseScale = 0.09; // Ajusté pour la taille de la balle
    this.noiseOffset = Math.random() * 1000; // Random offset for varied patterns
    this.colorVariation = 30; // Range of color variation
    this.baseColor = { r: 135, g: 206, b: 250 }; // lightblue base

    // Generate permutation table for noise
    this.perm = buildPermutationTable();
  }

  draw(ctx) {
    const pos = this.body.position;

    // Calculate the bounding box for the texture
    const bounds = {
      minX: Math.floor(pos.x - this.radius - 5),
      minY: Math.floor(pos.y - this.radius - 5),
      width: Math.ceil(this.radius * 2 + 10),
      height: Math.ceil(this.radius * 2 + 10),
    };

    // Create a temporary canvas for the noise texture
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = bounds.width;
    tempCanvas.height = bounds.height;

    // Draw noise texture to the temporary canvas
    const imageData = tempCtx.createImageData(bounds.width, bounds.height);
    for (let y = 0; y < bounds.height; y++) {
      for (let x = 0; x < bounds.width; x++) {
        // Use the external noise function
        const noiseVal = noise(
          (x + this.noiseOffset + pos.x) * this.noiseScale,
          (y + this.noiseOffset + pos.y) * this.noiseScale,
          this.perm
        );

        // Map noise to color variation
        const colorOffset = Math.floor(noiseVal * this.colorVariation);

        // Calculate pixel index
        const idx = (y * bounds.width + x) * 4;

        // Apply color with variation
        imageData.data[idx] = this.baseColor.r - colorOffset; // Red
        imageData.data[idx + 1] = this.baseColor.g - colorOffset; // Green
        imageData.data[idx + 2] = this.baseColor.b - colorOffset; // Blue
        imageData.data[idx + 3] = 255; // Alpha (fully opaque)
      }
    }
    tempCtx.putImageData(imageData, 0, 0);

    // Draw the ball with texture
    ctx.save();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, this.radius, 0, Math.PI * 2);
    ctx.closePath();

    // Create pattern from the temporary canvas
    const pattern = ctx.createPattern(tempCanvas, "no-repeat");
    if (pattern) {
      // Position the pattern correctly
      const patternTransform = new DOMMatrix().translateSelf(
        bounds.minX,
        bounds.minY
      );
      pattern.setTransform(patternTransform);

      // Fill with the pattern
      ctx.fillStyle = pattern;
      ctx.fill();
    } else {
      // Fallback to solid color if pattern creation fails
      ctx.fillStyle = `rgb(${this.baseColor.r}, ${this.baseColor.g}, ${this.baseColor.b})`;
      ctx.fill();
    }

    {
      ctx.save();
      ctx.filter = "blur(4px) drop-shadow(0 0 3px white)";
      ctx.lineWidth = 5;
      ctx.strokeStyle = pattern; // Utilise le pattern noise pour le contour
      ctx.stroke();
      ctx.restore();
    }
  }
}
