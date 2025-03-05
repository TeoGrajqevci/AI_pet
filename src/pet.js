import { Bodies, Constraint, Composite, Body } from 'matter-js';
import { buildPermutationTable, noise } from './utils/noiseUtils.js';

// Helper: returns a random number between min and max.
function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

export class Pet { 
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.fullness = 90;
    this.happiness = 90;
    this.isDead = false;
    
    this.baseDistance = 100;
    this.numPoints = 16;
    
    // Create a composite for the pet.
    this.composite = Composite.create({ label: 'PetComposite' });
    
    // Generate a unique collision group for the pet parts.
    const petGroup = Body.nextGroup(true);
    
    // Create the central body (face) and assign it the pet group.
    this.center = Bodies.circle(x, y, 40, { 
      friction: 0.1, 
      restitution: 0.8, 
      label: 'Pet',
      collisionFilter: { group: petGroup }
    });
    Composite.add(this.composite, this.center);
    
    // Create peripheral particles in a circle and assign them the same group.
    this.particles = [];
    this.centerConstraints = [];
    for (let i = 0; i < this.numPoints; i++) {
      const angle = (2 * Math.PI / this.numPoints) * i;
      const px = x + this.baseDistance * Math.cos(angle);
      const py = y + this.baseDistance * Math.sin(angle);
      const particle = Bodies.circle(px, py, 16, { 
        friction: 0.1, 
        restitution: 0.8, 
        label: 'Pet',
        collisionFilter: { group: petGroup }
      });
      this.particles.push(particle);
      Composite.add(this.composite, particle);
      
      const constraint = Constraint.create({
        bodyA: this.center,
        bodyB: particle,
        length: this.baseDistance,
        stiffness: 0.01,
      });
      this.centerConstraints.push(constraint);
      Composite.add(this.composite, constraint);
    }
    
    // Create constraints between adjacent peripheral particles.
    this.edgeConstraints = [];
    for (let i = 0; i < this.numPoints; i++) {
      const nextIndex = (i + 1) % this.numPoints;
      const constraint = Constraint.create({
        bodyA: this.particles[i],
        bodyB: this.particles[nextIndex],
        length: 2 * this.baseDistance * Math.sin(Math.PI / this.numPoints),
        stiffness: 0.3,
      });
      this.edgeConstraints.push(constraint);
      Composite.add(this.composite, constraint);
    }
    
    // (Rest of your initialization for idleTimer, blinkTimer, etc.)
    this.idleTimer = 0;
    this.blinkTimer = 0;
    this.blinkInterval = 3;
    this.blinkDuration = 0.2;
    this.isBlinking = false;
    
    // Timers and target for ball play behavior.
    this.ballJumpTimer = 0;
    this.nextBallJumpTime = null;
    this.ballTarget = null;
    
    // Timers for food jumping behavior when hungry
    this.foodJumpTimer = 0;
    this.nextFoodJumpTime = null;
    this.hungerThreshold = 50; // Define hunger threshold

    // Minimum scale factor for the pet size (when fullness is 0)
    this.minScaleFactor = 0.4; // The pet will never be smaller than 50% of its base size

    // Initialize noise parameters for the texture
    this.noiseScale = 0.1; // Scale of the noise pattern
    this.noiseOffset = Math.random() * 1000; // Random offset for varied patterns
    this.colorVariation = 20; // Range of color variation
    
    // Initial color and color name
    this.baseColor = { r: 255, g: 182, b: 193 }; // Base pink color (light pink)
    this.colorName = "pink"; // Initial color name
    
    // Update color based on initial stats
    this.updateColor();
    
    // Generate permutation table for noise
    this.perm = buildPermutationTable();
  }
  
  // New method to update pet color based on stats
  updateColor() {
    // Mapping colors based on fullness and happiness levels
    if (this.fullness >= 75 && this.happiness >= 75) {
      // Very happy and very full → Pink (original color)
      this.baseColor = { r: 255, g: 182, b: 193 };
      this.colorName = "pink";
    } else if (this.fullness >= 50 && this.happiness >= 50) {
      // Happy and full → Light purple
      this.baseColor = { r: 216, g: 191, b: 216 };
      this.colorName = "purple";
    } else if (this.fullness < 50 && this.happiness >= 50) {
      // Hungry but happy → Yellow
      this.baseColor = { r: 255, g: 255, b: 102 };
      this.colorName = "yellow";
    } else if (this.fullness >= 50 && this.happiness < 50) {
      // Full but sad → Blue
      this.baseColor = { r: 173, g: 216, b: 230 };
      this.colorName = "blue";
    } else if (this.fullness < 30 && this.happiness < 30) {
      // Very hungry and very sad → Gray
      this.baseColor = { r: 169, g: 169, b: 169 };
      this.colorName = "gray";
    } else {
      // Hungry and sad → Green
      this.baseColor = { r: 144, g: 238, b: 144 };
      this.colorName = "green";
    }
  }
  
  // Modified jump: if a direction is provided, jump toward that; else random upward.
  jump(direction) {
    const forceMagnitude = 5.0; // Force magnitude set to 1.2
    let force;
    if (direction) {
      const mag = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
      if (mag > 0) {
        force = { x: (forceMagnitude * direction.x) / mag, y: (forceMagnitude * direction.y) / mag };
      } else {
        force = { x: 0, y: -forceMagnitude };
      }
    } else {
      const angle = (-Math.PI / 2) + randomInRange(-0.35, 0.35);
      force = { x: forceMagnitude * Math.cos(angle), y: forceMagnitude * Math.sin(angle) };
    }
    Body.applyForce(this.center, this.center.position, force);
  }
  
  update(deltaTime) {
    if (this.isDead) return;
    
    this.idleTimer += deltaTime;
    
    // Blink logic.
    this.blinkTimer += deltaTime;
    if (!this.isBlinking && this.blinkTimer >= this.blinkInterval) {
      this.isBlinking = true;
      this.blinkTimer = 0;
    } else if (this.isBlinking && this.blinkTimer >= this.blinkDuration) {
      this.isBlinking = false;
      this.blinkTimer = 0;
    }
    
    // Decrease fullness and happiness.
    this.fullness -= 3 * deltaTime;
    
    // If pet is hungry (fullness < 50), happiness decreases faster
    if (this.fullness < 50) {
      // Calculate hunger factor (0-1 range)
      const hungerFactor = (50 - this.fullness) / 50;
      // Happiness decreases faster when hungrier (up to 2x faster)
      this.happiness -= (3 + (3 * hungerFactor)) * deltaTime;
    } else {
      // Normal happiness decrease when not hungry
      this.happiness -= 3 * deltaTime;
    }
    
    // Update pet color based on current stats
    this.updateColor();
    
    if (this.fullness <= 0 || this.happiness <= 0 || this.fullness >= 100) {
      this.isDead = true;
      return;
    }
    
    // Adjust constraints based on fullness, with a minimum size threshold
    // The scale factor goes from minScaleFactor (when fullness=0) to 2.0 (when fullness=100)
    const minScale = this.minScaleFactor;
    const maxScale = 1.8;
    const scaleFactor = minScale + ((maxScale - minScale) * (this.fullness / 100));
    
    // Apply the scale factor to the constraint lengths
    const targetLength = this.baseDistance * scaleFactor;
    for (const constraint of this.centerConstraints) {
      constraint.length = targetLength;
    }
    
    const edgeTarget = 2 * targetLength * Math.sin(Math.PI / this.numPoints);
    for (const constraint of this.edgeConstraints) {
      constraint.length = edgeTarget;
    }
  }
  
  // Called when pet eats food.
  eatFood() {
    this.fullness += 15;
    if (this.fullness > 100) this.fullness = 100;
    this.happiness += 5;
    if (this.happiness > 100) this.happiness = 100;
  }
  
  // When not playing with the ball, use normal movement (e.g., toward food).
  updateMovement(foods) {
    if (foods.length > 0) {
      let closest = foods[0];
      let minDist = this._distance(this.center.position, closest.body.position);
      for (const food of foods) {
        const d = this._distance(this.center.position, food.body.position);
        if (d < minDist) {
          minDist = d;
          closest = food;
        }
      }
      // NEW: Set food target so pupils can look at it.
      this.foodTarget = closest.body.position;

      const dx = closest.body.position.x - this.center.position.x;
      const dy = closest.body.position.y - this.center.position.x;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Initialize jump timer if needed - always jump towards food
      if (this.nextFoodJumpTime === null) {
        this.nextFoodJumpTime = randomInRange(0.8, 1.5);
      }
      
      this.foodJumpTimer += 1/60;
      
      if (this.foodJumpTimer >= this.nextFoodJumpTime && dist > 50) {
        const direction = { x: dx, y: dy };
        this.jump(direction);
        this.foodJumpTimer = 0;
        this.nextFoodJumpTime = randomInRange(0.8, 1.5);
      }
      
      if (dist > 0) {
        const normX = dx / dist;
        const normY = dy / dist;
        const speedFactor = ((100 - this.fullness) / 100) + 0.5;
        const forceMag = 0.0005 * speedFactor;
        Body.applyForce(this.center, this.center.position, { x: normX * forceMag, y: normY * forceMag });
      }
    } else {
      // NEW: Clear food target when no food exists.
      this.foodTarget = null;
      this.foodJumpTimer = 0;
      this.nextFoodJumpTime = null;
      
      const randomForce = { x: (Math.random() - 0.5) * 0.0002, y: (Math.random() - 0.5) * 0.0002 };
      Body.applyForce(this.center, this.center.position, randomForce);
    }
  }
  
  // New method: when a play ball is present, the pet plays with it.
  playWithBall(ball, deltaTime) {
    // Gradually increase happiness.
    this.happiness += 2 * deltaTime;
    if (this.happiness > 100) this.happiness = 100;
    
    // Initialize ball jump timer if needed.
    if (this.nextBallJumpTime === null) {
      this.nextBallJumpTime = (this.happiness > 80) ? randomInRange(1, 2) : randomInRange(2, 3);
    }
    this.ballJumpTimer += deltaTime;
    if (this.ballJumpTimer >= this.nextBallJumpTime) {
      // Compute direction from pet to ball.
      const dx = ball.body.position.x - this.center.position.x;
      const dy = ball.body.position.y - this.center.position.y;
      const direction = { x: dx, y: dy };
      this.jump(direction);
      this.ballJumpTimer = 0;
      this.nextBallJumpTime = (this.happiness > 80) ? randomInRange(1, 2.5) : randomInRange(1.5, 3);
    }
  }
  
  // Store the ball target so the pet's eyes can track it.
  setBallTarget(pos) {
    this.ballTarget = pos;
  }
  
  // Utility: distance between two points.
  _distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  // Méthode mise à jour pour générer la description du pet avec la couleur actuelle.
  getMasterPrompt() {
    // État basé sur fullness et happiness
    let state = "";
    if (this.fullness < 50) {
      state += "hungry";
    } else {
      state += "well-fed";
    }
    
    if (this.happiness < 50) {
      state += " and sad";
    } else {
      state += " and happy";
    }
    
    return `A cute ${this.colorName} ${state} pet`;
  }

  draw(ctx) {
    // Gather peripheral particle positions.
    let points = this.particles.map(p => ({ x: p.position.x, y: p.position.y }));
    const center = this.center.position;
    points.sort((a, b) => {
      return Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x);
    });
    
    // Draw the soft, smooth blob with Perlin noise texture
    const currentConstraintLength = this.centerConstraints[0].length;
    const scaleFactor = currentConstraintLength / this.baseDistance;
    
    // Define bounds for the drawing
    const bounds = this.calculateBounds(points);
    
    // Create a temporary canvas for the noise texture
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = bounds.width;
    tempCanvas.height = bounds.height;
    
    // Draw noise texture to the temporary canvas
    const imageData = tempCtx.createImageData(bounds.width, bounds.height);
    for (let y = 0; y < bounds.height; y++) {
      for (let x = 0; x < bounds.width; x++) {
        // Use the external noise function instead of the class method
        const noiseVal = noise(
          (x + this.noiseOffset + center.x) * this.noiseScale, 
          (y + this.noiseOffset + center.y) * this.noiseScale,
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
    
    // Now draw the blob with the pattern fill
    // First create a clipping path for the blob shape
    ctx.save();
    ctx.beginPath();
    const first = points[0];
    const last = points[points.length - 1];
    const firstMid = { x: (last.x + first.x) / 2, y: (last.y + first.y) / 2 };
    ctx.moveTo(firstMid.x, firstMid.y);
    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      const next = points[(i + 1) % points.length];
      const mid = { x: (current.x + next.x) / 2, y: (current.y + next.y) / 2 };
      ctx.quadraticCurveTo(current.x, current.y, mid.x, mid.y);
    }
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
      ctx.fillStyle = `rgb(${this.baseColor.r}, ${this.baseColor.g}, this.baseColor.b)`;
      ctx.fill();
    }
    
    // Draw outline
    if (window.borderBlurred) {
      ctx.save();
      ctx.filter = 'blur(3px) drop-shadow(0 0 6px white)';
      ctx.lineWidth = 20 * scaleFactor;
      ctx.strokeStyle = pattern; // Utilise le pattern noise pour le contour
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.lineWidth = 3 * scaleFactor;
      ctx.strokeStyle = `rgba(${this.baseColor.r}, ${this.baseColor.g}, ${this.baseColor.b}, 0.8)`;
      ctx.stroke();
    }
    
    // Calculate a scaling factor based on the pet's current size relative to its base size
    // Use the current constraint length which is affected by fullness
  
    
    // Scale base dimensions according to the pet's body size
    const baseEyeOffsetX = 24 * scaleFactor;
    const baseEyeSize = 20 * scaleFactor;
    const baseMouthOffset = 24 * scaleFactor;
    const baseMouthSize = 12 * scaleFactor;
    
    // Draw the pet's face with scaled dimensions
    // Base eye positions.
    const eyeOffsetX = baseEyeOffsetX;
    let eyeOffsetY = (-6 * scaleFactor) + Math.sin(this.idleTimer * 3) * 1.5 + ((50 - this.happiness) / 50 * 2 * scaleFactor);
    // Compute initial eye and mouth positions (centered on the pet).
    let leftEyeX = this.center.position.x - eyeOffsetX;
    let leftEyeY = this.center.position.y + eyeOffsetY;
    let rightEyeX = this.center.position.x + eyeOffsetX;
    let rightEyeY = this.center.position.y + eyeOffsetY;
    let mouthX = this.center.position.x;
    let mouthY = this.center.position.y + baseMouthOffset + Math.sin(this.idleTimer * 2) * 2 * scaleFactor;
    
    // If a ball target exists, increase offsets so the face looks more toward it.
    if (this.ballTarget) {
      const dx = this.ballTarget.x - this.center.position.x;
      const dy = this.ballTarget.y - this.center.position.y;
      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag > 0) {
        const eyeOffsetFactor = 40 * scaleFactor;   // Scale the eye movement
        const mouthOffsetFactor = 40 * scaleFactor;  // Scale the mouth movement
        leftEyeX += (dx / mag) * eyeOffsetFactor;
        leftEyeY += (dy / mag) * eyeOffsetFactor;
        rightEyeX += (dx / mag) * eyeOffsetFactor;
        rightEyeY += (dy / mag) * eyeOffsetFactor;
        mouthX += (dx / mag) * mouthOffsetFactor;
        mouthY += (dy / mag) * mouthOffsetFactor;
      }
    }
    
    // Draw the eyes with scaled size.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    if (this.isBlinking) {
      ctx.beginPath();
      ctx.moveTo(leftEyeX - baseEyeSize, leftEyeY);
      ctx.lineTo(leftEyeX + baseEyeSize, leftEyeY);
      ctx.moveTo(rightEyeX - baseEyeSize, rightEyeY);
      ctx.lineTo(rightEyeX + baseEyeSize, rightEyeY);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(leftEyeX, leftEyeY, baseEyeSize, 0, 2 * Math.PI);
      ctx.arc(rightEyeX, rightEyeY, baseEyeSize, 0, 2 * Math.PI);
      ctx.fill();
      
      // Updated pupil drawing: pupils track both ballTarget and foodTarget.
      const pupilOffsetLimit = baseEyeSize * 0.4; // maximum pupil displacement within the eye
      let target = null;
      if (this.ballTarget && this.foodTarget) {
        target = {
          x: (this.ballTarget.x + this.foodTarget.x) / 2,
          y: (this.ballTarget.y + this.foodTarget.y) / 2,
        };
      } else if (this.ballTarget) {
        target = this.ballTarget;
      } else if (this.foodTarget) {
        target = this.foodTarget;
      }
      let pupilOffset = { x: 0, y: 0 };
      if (target) {
        const dx = target.x - this.center.position.x;
        const dy = target.y - this.center.position.y;
        const mag = Math.sqrt(dx * dx + dy * dy);
        if (mag > 0) {
          pupilOffset = { x: (dx / mag) * pupilOffsetLimit, y: (dy / mag) * pupilOffsetLimit };
        }
      }
      const pupilRadius = baseEyeSize * 0.5;
      ctx.fillStyle = 'black';
      // Left pupil
      ctx.beginPath();
      ctx.arc(leftEyeX + pupilOffset.x, leftEyeY + pupilOffset.y, pupilRadius, 0, 2 * Math.PI);
      ctx.fill();
      // Right pupil
      ctx.beginPath();
      ctx.arc(rightEyeX + pupilOffset.x, rightEyeY + pupilOffset.y, pupilRadius, 0, 2 * Math.PI);
      ctx.fill();
    }
    
    // Draw the mouth with scaled size.
    ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
    ctx.lineWidth = 5 * scaleFactor; // Increased stroke weight for the mouth
    ctx.beginPath();
    if (this.happiness > 50) {
      ctx.arc(mouthX, mouthY, baseMouthSize, 0, Math.PI, false);
    } else {
      ctx.arc(mouthX, mouthY, baseMouthSize, Math.PI, 2 * Math.PI, false);
    }
    ctx.stroke();
    
    // Restore previous line width if needed for other drawing operations
    ctx.lineWidth = 3 * scaleFactor;
  }
  
  // Helper to calculate bounds of a set of points
  calculateBounds(points) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    
    // Add padding
    const padding = 20;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    return {
      minX: Math.floor(minX),
      minY: Math.floor(minY),
      width: Math.ceil(maxX - minX),
      height: Math.ceil(maxY - minY)
    };
  }
  
}
