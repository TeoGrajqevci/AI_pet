import { Bodies } from 'matter-js';
import { buildPermutationTable, noise } from './utils/noiseUtils.js';

export class Food {
  constructor(x, y) {
    // Amélioration des propriétés physiques pour faciliter le roulement
    this.body = Bodies.circle(x, y, 36, { 
      restitution: 0.4,      // Réduit légèrement le rebond pour plus de stabilité
      friction: 0.0001,       // Une très petite friction pour mieux rouler
      frictionAir: 0.00005,   // Très faible résistance à l'air
      frictionStatic: 0.5,  // Nécessite très peu de force pour commencer à rouler
      density: 0.001,        // Densité plus faible pour rendre l'objet plus léger
      label: 'Food' 
    });
    
    // Initialize properties (keep radius same for texture mapping)
    this.radius = 36;
    this.noiseScale = 0.1;
    this.noiseOffset = Math.random() * 1000;
    this.colorVariation = 40;
    // Change base color to red
    this.baseColor = { r: 255, g: 0, b: 0 };
    
    // Nouvelle propriété pour suivre le temps d'apparition
    this.spawnTime = Date.now();
    // Indique si la nourriture est prête à être mangée
    this.isEdible = false;
    
    // Generate permutation table for noise
    this.perm = buildPermutationTable();
  }
  
  // Nouvelle méthode pour vérifier si la nourriture est prête à être mangée
  update() {
    const currentTime = Date.now();
    // La nourriture devient mangeable après 1 seconde
    if (currentTime - this.spawnTime >= 2000 && !this.isEdible) {
      this.isEdible = true;
    }
  }
  
  draw(ctx) {
    const pos = this.body.position;
    
    // Calculate the bounding box for the texture
    const bounds = {
      minX: Math.floor(pos.x - this.radius - 5),
      minY: Math.floor(pos.y - this.radius - 5),
      width: Math.ceil(this.radius * 2 + 10),
      height: Math.ceil(this.radius * 2 + 10)
    };
    
    // Create a temporary canvas for the noise texture
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
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
        
        // Apply color with variation - plus clair si mangeable
        const colorMultiplier = this.isEdible ? 0.8 : 1; // Plus clair si mangeable
        imageData.data[idx] = this.baseColor.r - colorOffset * colorMultiplier; // Red
        imageData.data[idx + 1] = this.baseColor.g - colorOffset * colorMultiplier; // Green
        imageData.data[idx + 2] = this.baseColor.b - colorOffset * colorMultiplier; // Blue
        imageData.data[idx + 3] = 255; // Alpha (fully opaque)
      }
    }
    tempCtx.putImageData(imageData, 0, 0);
    
    // Replace triangle drawing with circle drawing
    ctx.save();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, this.radius, 0, Math.PI * 2);
    ctx.closePath();
    
    // Create pattern from the temporary canvas
    const pattern = ctx.createPattern(tempCanvas, 'no-repeat');
    if (pattern) {
      // Position the pattern correctly
      const patternTransform = new DOMMatrix()
        .translateSelf(bounds.minX, bounds.minY);
      pattern.setTransform(patternTransform);
      
      // Fill with the pattern
      ctx.fillStyle = pattern;
      ctx.fill();
    } else {
      // Fallback to solid color if pattern creation fails
      ctx.fillStyle = `rgb(${this.baseColor.r}, ${this.baseColor.g}, ${this.baseColor.b})`;
      ctx.fill();
    }
    
    // Modification: Draw brown stem that rotates with the apple
    ctx.save();
    ctx.beginPath();
    // Calculate stem position using the body's angle
    const stemBaseX = pos.x + Math.sin(this.body.angle) * this.radius;
    const stemBaseY = pos.y - Math.cos(this.body.angle) * this.radius;
    // Draw stem from the edge of the circle outward
    const stemLength = 20;
    const stemEndX = pos.x + Math.sin(this.body.angle) * (this.radius + stemLength);
    const stemEndY = pos.y - Math.cos(this.body.angle) * (this.radius + stemLength);
    ctx.moveTo(stemBaseX, stemBaseY);
    ctx.lineTo(stemEndX, stemEndY);
    ctx.strokeStyle = 'brown';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
    
    // Draw outline
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'brown';

    ctx.save();
    // Ajouter un effet de pulsation quand la nourriture est prête à être mangée
    if (this.isEdible) {
      ctx.filter = 'blur(4px) drop-shadow(0 0 8px white)';
      ctx.lineWidth = 5 + Math.sin(Date.now() / 200) * 2; // Effet de pulsation
    } else {
      ctx.filter = 'blur(4px) drop-shadow(0 0 3px white)';
      ctx.lineWidth = 5;
    }
    ctx.strokeStyle = pattern;
    ctx.stroke();
    ctx.restore();
  }
}
