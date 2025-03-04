import { Engine, Composite, Bodies, Body, Events } from 'matter-js';
import { Pet } from './pet.js';
import { Food } from './food.js';
import { Ball } from './ball.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lastTime = 0;
    this.gameOver = false;
    
    // Create Matter.js engine and world.
    this.engine = Engine.create({
      positionIterations: 20,    
      velocityIterations: 20,   
      constraintIterations: 8,  // Default is 2, higher values increase constraint precision
      timeScale: 1              // Normal time scale
    });
    this.world = this.engine.world;
    
    // Create static walls so objects bounce off the canvas edges.
    const thickness = 50;
    const width = canvas.width;
    const height = canvas.height;
    const walls = [
      Bodies.rectangle(width / 2, -thickness / 2, width, thickness, { isStatic: true }),
      Bodies.rectangle(width / 2, height + thickness / 2, width, thickness, { isStatic: true }),
      Bodies.rectangle(-thickness / 2, height / 2, thickness, height, { isStatic: true }),
      Bodies.rectangle(width + thickness / 2, height / 2, thickness, height, { isStatic: true })
    ];
    Composite.add(this.world, walls);
    
    // Create the pet at the center.
    this.pet = new Pet(canvas.width / 2, canvas.height / 2);
    Composite.add(this.world, this.pet.composite);
    
    // Array to hold food objects.
    this.foods = [];
    
    // Play ball – only one ball allowed at a time.
    this.ball = null;
    
    this.bindEvents();

    // Collision events for eating food.
    // In game.js, after creating the engine and adding objects:
    Events.on(this.engine, 'collisionStart', event => {
      event.pairs.forEach(pair => {
        // Gérer les collisions avec la nourriture.
        if (
          (pair.bodyA.label === 'Food' && pair.bodyB.label === 'Pet') ||
          (pair.bodyB.label === 'Food' && pair.bodyA.label === 'Pet')
        ) {
          let foodBody = (pair.bodyA.label === 'Food') ? pair.bodyA : pair.bodyB;
          const foodInstance = this.foods.find(food => food.body === foodBody);
          if (foodInstance) {
            if (!foodInstance.hasBounced) {
              // Appliquer un rebond : marquer comme rebondi et pousser la nourriture.
              foodInstance.hasBounced = true;
              const petCenter = this.pet.center.position;
              const dx = foodBody.position.x - petCenter.x;
              const dy = foodBody.position.y - petCenter.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const bounceForceMagnitude = 0.05; // À ajuster selon besoin
              if (distance > 0) {
                const force = { x: (dx / distance) * bounceForceMagnitude, y: (dy / distance) * bounceForceMagnitude };
                Body.applyForce(foodBody, foodBody.position, force);
              }
            } else {
              // La nourriture a déjà rebondi : l'animal mange.
              this.pet.eatFood();
              Composite.remove(this.world, foodBody);
              this.foods = this.foods.filter(food => food.body !== foodBody);
              document.getElementById('feedBtn').disabled = false;
            }
          }
        }
        // Handle ball collisions
        if (
          (pair.bodyA.label === 'Ball' && pair.bodyB.label === 'Pet') ||
          (pair.bodyB.label === 'Ball' && pair.bodyA.label === 'Pet')
        ) {
          // Increase pet's happiness upon collision with the ball.
          this.pet.happiness += 3;
          if (this.pet.happiness > 100) this.pet.happiness = 100;
          
          // Determine ball body and pet body
          let ballBody = pair.bodyA.label === 'Ball' ? pair.bodyA : pair.bodyB;
          let petBody = pair.bodyA.label === 'Pet' ? pair.bodyA : pair.bodyB;
          
          // Compute direction from pet center to the ball.
          const dx = ballBody.position.x - this.pet.center.position.x;
          const dy = ballBody.position.y - this.pet.center.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 0) {
            // Normalize direction vector
            const normalizedDx = dx / distance;
            const normalizedDy = dy / distance;
            
            // Apply strong force to the ball in the direction away from the pet (as if kicked)
            // The force is stronger than the pet's jump force
            const kickMagnitude = 0.15; // Adjust this value to control kick strength
            Body.applyForce(ballBody, ballBody.position, {
              x: normalizedDx * kickMagnitude,
              y: normalizedDy * kickMagnitude
            });
            
            // Make the pet jump in the direction of the ball (reduced effect)
            const direction = { x: dx, y: dy };
            this.pet.jump(direction);
          }
        }
      });
    });
  }

  bindEvents() {
    // Feed button spawns food from the sides.
    document.getElementById('feedBtn').addEventListener('click', () => {
      // Vérifier s'il y a déjà de la nourriture - ne rien faire si c'est le cas
      if (this.foods.length > 0) {
        return;
      }
      
      let x, y, initialVelocity;
      if (Math.random() < 0.5) {
        // Spawn from left side.
        x = -20;
        y = Math.random() * (this.canvas.height - 100) + 50;
        initialVelocity = { x: 3, y: 0 };
      } else {
        // Spawn from right side.
        x = this.canvas.width + 20;
        y = Math.random() * (this.canvas.height - 100) + 50;
        initialVelocity = { x: -3, y: 0 };
      }
      const food = new Food(x, y);
      Body.setVelocity(food.body, initialVelocity);
      Composite.add(this.world, food.body);
      this.foods.push(food);
      
      // Désactiver le bouton d'alimentation jusqu'à ce que l'animal mange
      document.getElementById('feedBtn').disabled = true;
    });
    
    const playBtn = document.getElementById('playBtn');
    playBtn.addEventListener('click', () => {
      if (!this.ball) {
        // Spawn the ball from the top within visible bounds.
        const x = Math.random() * (this.canvas.width - 60) + 30; // ensure margin on both sides
        const y = 30; // visible near the top
        // Give it an initial velocity with a random horizontal component and a downward speed.
        const initialVelocity = { x: (Math.random() - 0.5) * 6, y: 4 };
        this.ball = new Ball(x, y);
        Body.setVelocity(this.ball.body, initialVelocity);
        Composite.add(this.world, this.ball.body);
        playBtn.disabled = true;
        
        // After 10 seconds, remove the ball and re-enable the play button.
        setTimeout(() => {
          if (this.ball) {
            Composite.remove(this.world, this.ball.body);
            this.ball = null;
            playBtn.disabled = false;
            // Clear ball target from pet.
            this.pet.setBallTarget(null);
          }
        }, 10000);
      }
    });
  }

  start() {
    requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
  }

  gameLoop(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const deltaTime = (timestamp - this.lastTime) / 1000; // seconds
    this.lastTime = timestamp;
    
    this.update(deltaTime);
    this.draw();
    
    // Update stats panel.
    document.getElementById('stats').innerText =
      `Fullness: ${Math.floor(this.pet.fullness)} | Happiness: ${Math.floor(this.pet.happiness)}`;
    
    if (!this.gameOver) {
      requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
    } else {
      this.drawGameOver();
    }
  }

  update(deltaTime) {
    // Update physics engine.
    Engine.update(this.engine, deltaTime * 1000);
    
    // Update pet state.
    this.pet.update(deltaTime);
    
    // If a play ball exists, have the pet play with it.
    if (this.ball) {
      this.pet.playWithBall(this.ball, deltaTime);
      this.pet.setBallTarget(this.ball.body.position);
    } else {
      // Otherwise, follow normal movement (e.g., toward food if present).
      this.pet.updateMovement(this.foods);
      this.pet.setBallTarget(null);
    }
    
    if (this.pet.isDead) {
      this.gameOver = true;
    }
  }

  draw() {
    // Clear canvas.
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw pet.
    this.pet.draw(this.ctx);
    
    // Draw food objects.
    for (const food of this.foods) {
      food.draw(this.ctx);
    }
    
    // Draw the play ball if it exists.
    if (this.ball) {
      this.ball.draw(this.ctx);
    }
  }

  drawGameOver() {
    this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = 'white';
    this.ctx.font = '48px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Game Over', this.canvas.width / 2, this.canvas.height / 2);
  }
}
