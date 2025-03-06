import { Engine, Composite, Bodies, Body, Events } from "matter-js";
import { Pet } from "./pet.js";
import { Food } from "./food.js";
import { Ball } from "./ball.js";
import { buildPermutationTable, noise } from "./utils/noiseUtils.js";
import { sendPrompt } from "./api.js";
import { SoundManager } from "./soundManager.js";

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.lastTime = 0;
    this.gameOver = false;
    this.startMenuActive = true;
    // Nouvel indicateur pour suivre la première pression de la touche "b"
    this.firstBKeyPressed = false;

    // Create Matter.js engine and world.
    this.engine = Engine.create({
      positionIterations: 20,
      velocityIterations: 20,
      constraintIterations: 8, // Default is 2, higher values increase constraint precision
      timeScale: 1, // Normal time scale
    });
    this.world = this.engine.world;

    // Create static walls so objects bounce off the canvas edges.
    const thickness = 50;
    const width = canvas.width;
    const height = canvas.height;
    const walls = [
      Bodies.rectangle(width / 2, -thickness / 2, width, thickness, {
        isStatic: true,
      }),
      Bodies.rectangle(width / 2, height + thickness / 2, width, thickness, {
        isStatic: true,
      }),
      Bodies.rectangle(-thickness / 2, height / 2, thickness, height, {
        isStatic: true,
      }),
      Bodies.rectangle(width + thickness / 2, height / 2, thickness, height, {
        isStatic: true,
      }),
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
    Events.on(this.engine, "collisionStart", (event) => {
      event.pairs.forEach((pair) => {
        // Gérer les collisions avec la nourriture.
        if (
          (pair.bodyA.label === "Food" && pair.bodyB.label === "Pet") ||
          (pair.bodyB.label === "Food" && pair.bodyA.label === "Pet")
        ) {
          let foodBody = pair.bodyA.label === "Food" ? pair.bodyA : pair.bodyB;
          const foodInstance = this.foods.find(
            (food) => food.body === foodBody
          );
          if (foodInstance) {
            if (foodInstance.isEdible) {
              // La nourriture est prête à être mangée (après 1 seconde)
              this.pet.eatFood();
              // Jouer le son de manger une seule fois
              this.soundManager.playSfx("./assets/random8bit-6.mp3");
              Composite.remove(this.world, foodBody);
              this.foods = this.foods.filter((food) => food.body !== foodBody);
              document.getElementById("feedBtn").disabled = false;
            } else {
              // La nourriture n'est pas encore prête, appliquer un rebond
              const petCenter = this.pet.center.position;
              const dx = foodBody.position.x - petCenter.x;
              const dy = foodBody.position.y - petCenter.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const bounceForceMagnitude = 0.05;
              if (distance > 0) {
                const force = {
                  x: dx * bounceForceMagnitude,
                  y: dy * bounceForceMagnitude,
                };
                Body.applyForce(foodBody, foodBody.position, force);
              }
            }
          }
        }
        // Handle ball collisions
        if (
          (pair.bodyA.label === "Ball" && pair.bodyB.label === "Pet") ||
          (pair.bodyB.label === "Ball" && pair.bodyA.label === "Pet")
        ) {
          // Increase pet's happiness upon collision with the ball.
          this.pet.happiness += 3;
          if (this.pet.happiness > 100) this.pet.happiness = 100;

          // Determine ball body and pet body
          let ballBody = pair.bodyA.label === "Ball" ? pair.bodyA : pair.bodyB;
          let petBody = pair.bodyA.label === "Pet" ? pair.bodyA : pair.bodyB;

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
            const kickMagnitude = 1.15; // Adjust this value to control kick strength
            Body.applyForce(ballBody, ballBody.position, {
              x: normalizedDx * kickMagnitude,
              y: normalizedDy * kickMagnitude,
            });

            // Make the pet jump in the direction of the ball (reduced effect)
            const direction = { x: dx, y: dy };
            this.pet.jump(direction);
          }
        }
      });
    });

    this.lastPrompt = ""; // Nouveau : stocke le dernier prompt affiché

    // Initialize UI noise seeds and table so gauge textures mimic pet style but remain fixed.
    this.uiFullSeed = Math.random() * 1000;
    this.uiHappySeed = Math.random() * 1000;
    this.uiPerm = buildPermutationTable();

    // Instantiate SoundManager and add a flag to prevent repeated stop calls.
    this.soundManager = new SoundManager();
    this.musicStopped = false;
  }

  bindEvents() {
    // Feed button spawns food from the sides.
    document.getElementById("feedBtn").addEventListener("click", () => {
      // Vérifier s'il y a déjà de la nourriture - ne rien faire si c'est le cas
      if (this.foods.length > 0) {
        return;
      }

      let x, y, initialVelocity;
      if (Math.random() < 0.5) {
        // Spawn depuis le côté gauche.
        x = 36;
        y = 100;
        initialVelocity = { x: 5, y: 0 }; // vitesse réduite
      } else {
        // Spawn depuis le côté droit.
        x = this.canvas.width - 36;
        y = 100;
        initialVelocity = { x: -5, y: 0 }; // vitesse réduite
      }
      const food = new Food(x, y);
      Body.setVelocity(food.body, initialVelocity);
      Composite.add(this.world, food.body);
      this.foods.push(food);

      // Désactiver le bouton d'alimentation jusqu'à ce que l'animal mange
      document.getElementById("feedBtn").disabled = true;
    });

    const playBtn = document.getElementById("playBtn");
    playBtn.addEventListener("click", () => {
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

  // Modified start() to begin the game loop immediately.
  start() {
    // Activate start menu before starting the game loop.

    this.startMenuActive = true;
    this.beginGame();
    // Listen for the 'b' key press to begin the game.
    const startListener = (event) => {
      if (event.key === "b" || event.key === "B") {
        document.removeEventListener("keydown", startListener);
        this.startMenuActive = false;
        this.soundManager.playSfx("./assets/start.mp3");
        //requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
      }
    };
    document.addEventListener("keydown", startListener);
  }

  // New method: begins the game after user interaction.
  beginGame() {
    this.soundManager.playMusic("./assets/backgroundMusic-3-8bit.mp3");
    // Initialize lastTime to avoid jump in gameLoop.
    this.lastTime = performance.now();
    requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
  }

  gameLoop(timestamp) {
    if (this.startMenuActive) {
      this.drawStartMenu();
      requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
      this.lastTime = timestamp;
    } else {
      if (!this.lastTime) this.lastTime = timestamp;
      const deltaTime = (timestamp - this.lastTime) / 1000; // seconds
      this.lastTime = timestamp;
      // console.log(deltaTime, timestamp);
      this.update(deltaTime);
      this.draw();

      // Mise à jour du panneau des stats.
      document.getElementById("stats").innerText = `Fullness: ${Math.floor(
        this.pet.fullness
      )} | Happiness: ${Math.floor(this.pet.happiness)}`;

      // Génère le prompt du pet et l'enrichit selon la présence d'objets
      let masterPrompt = this.pet.getMasterPrompt();
      if (this.ball) {
        masterPrompt += ", playing with a blue ball, soccer ball, fun";
      }
      if (this.foods.length > 0) {
        masterPrompt += ", trying to eat a beautiful red apple, food, hungry";
      }

      // Mettre à jour le prompt uniquement s'il a changé
      if (masterPrompt !== this.lastPrompt) {
        console.log(masterPrompt);
        this.lastPrompt = masterPrompt;

        // Mise à jour de l'élément pour afficher le master prompt.
        const masterPromptEl = document.getElementById("masterPrompt");
        if (masterPromptEl) {
          masterPromptEl.innerText = masterPrompt;
          sendPrompt(masterPrompt);
        }
      }

      if (!this.gameOver) {
        requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
        return;
      } else {
        if (!this.musicStopped) {
          this.soundManager.stopMusic();
          this.musicStopped = true;
          // Jouer le son de game over une seule fois
          this.soundManager.playSfx("./assets/gameOver.mov");
        }
        this.drawGameOver();
      }
    }
  }

  update(deltaTime) {
    // console.log(deltaTime);

    const steps = 50; // Increased simulation steps per frame
    for (let i = 0; i < steps; i++) {
      Engine.update(this.engine, (deltaTime * 1000) / steps);
    }
    this.pet.update(deltaTime);

    if (this.ball) {
      console.log(deltaTime);

      this.pet.playWithBall(this.ball, deltaTime);
      this.pet.setBallTarget(this.ball.body.position);
    } else {
      this.pet.updateMovement(this.foods);
      this.pet.setBallTarget(null);
    }

    // Mettre à jour chaque nourriture pour vérifier si elle est prête à être mangée
    for (const food of this.foods) {
      food.update();
    }

    if (this.pet.isDead) {
      this.gameOver = true;
    }
  }

  draw() {
    this.ctx.fillStyle = "rgb(255, 255, 255)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

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

    // Draw UI gauges for fullness and happiness.
    this.drawUI(this.ctx);
  }

  drawGameOver() {
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.74)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Créer une bannière décorative avec motif de bruit
    const bannerWidth = 460;
    const bannerHeight = 300;
    const bannerX = (this.canvas.width - bannerWidth) / 2;
    const bannerY = (this.canvas.height - bannerHeight) / 2 - 20;
    
    // Créer un motif de bruit pour la bannière - avec une base rougeâtre
    const bannerSeed = this.uiFullSeed + 200; // Graine différente pour la bannière de game over
    const off = document.createElement("canvas");
    off.width = bannerWidth;
    off.height = bannerHeight;
    const offCtx = off.getContext("2d");
    const imageData = offCtx.createImageData(bannerWidth, bannerHeight);
    
    // Couleur de base rouge foncé pour la bannière
    const baseColor = { r: 180, g: 30, b: 30 };
    
    // Remplir le motif avec du bruit
    for (let j = 0; j < bannerHeight; j++) {
      for (let i = 0; i < bannerWidth; i++) {
        // Calculer la valeur de bruit avec une graine fixe
        const n = noise(i * 0.01 + bannerSeed, j * 0.01 + bannerSeed, this.uiPerm);
        const offset = Math.floor(n * 30);
        
        // Créer une texture rouge avec des variations de bruit
        const r = Math.max(Math.min(baseColor.r - offset, 255), 0);
        const g = Math.max(Math.min(baseColor.g - offset, 255), 0);
        const b = Math.max(Math.min(baseColor.b - offset, 255), 0);
        
        const idx = (j * bannerWidth + i) * 4;
        imageData.data[idx] = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = 255;
      }
    }
    
    offCtx.putImageData(imageData, 0, 0);
    const pattern = this.ctx.createPattern(off, "repeat");
    
    // Dessiner la bannière décorative avec le motif
    this.ctx.save();
    
    // Dessiner le fond de la bannière avec le motif de bruit
    this.ctx.fillStyle = pattern;
    this.roundRect(this.ctx, bannerX, bannerY, bannerWidth, bannerHeight, 20, true, false);
    
    // Dessiner la bordure ornée autour de la bannière
    this.ctx.lineWidth = 10;
    this.ctx.strokeStyle = "rgb(80, 10, 10)"; // Couleur rouge plus foncée pour la bordure
    this.roundRect(this.ctx, bannerX, bannerY, bannerWidth, bannerHeight, 20, false, true);
    
    // Ajouter une bordure intérieure avec un style différent
    this.ctx.lineWidth = 5;
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"; // Bordure intérieure moins brillante
    this.roundRect(this.ctx, bannerX + 15, bannerY + 15, bannerWidth - 30, bannerHeight - 30, 10, false, true);
    
    // Dessiner des fioritures décoratives dans les coins
    this.ctx.lineWidth = 6;
    this.ctx.strokeStyle = "rgb(100, 20, 20)"; // Rouge plus foncé pour les fioritures
    
    // Fioriture en haut à gauche
    this.ctx.beginPath();
    this.ctx.moveTo(bannerX + 30, bannerY + 30);
    this.ctx.bezierCurveTo(
      bannerX + 70, bannerY + 20,
      bannerX + 20, bannerY + 70,
      bannerX + 100, bannerY + 50
    );
    this.ctx.stroke();
    
    // Fioriture en haut à droite
    this.ctx.beginPath();
    this.ctx.moveTo(bannerX + bannerWidth - 30, bannerY + 30);
    this.ctx.bezierCurveTo(
      bannerX + bannerWidth - 70, bannerY + 20,
      bannerX + bannerWidth - 20, bannerY + 70,
      bannerX + bannerWidth - 100, bannerY + 50
    );
    this.ctx.stroke();
    
    // Fioriture en bas à gauche
    this.ctx.beginPath();
    this.ctx.moveTo(bannerX + 30, bannerY + bannerHeight - 30);
    this.ctx.bezierCurveTo(
      bannerX + 70, bannerY + bannerHeight - 20,
      bannerX + 20, bannerY + bannerHeight - 70,
      bannerX + 100, bannerY + bannerHeight - 50
    );
    this.ctx.stroke();
    
    // Fioriture en bas à droite
    this.ctx.beginPath();
    this.ctx.moveTo(bannerX + bannerWidth - 30, bannerY + bannerHeight - 30);
    this.ctx.bezierCurveTo(
      bannerX + bannerWidth - 70, bannerY + bannerHeight - 20,
      bannerX + bannerWidth - 20, bannerY + bannerHeight - 70,
      bannerX + bannerWidth - 100, bannerY + bannerHeight - 50
    );
    this.ctx.stroke();
    
    // Dessiner le texte avec ombre
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    // Définir le style du texte
    this.ctx.textAlign = "center";
    this.ctx.font = "bold 70px arial"; // Police plus grande pour plus d'impact
    
    // Ajouter une ombre au texte
    this.ctx.shadowColor = "rgba(0, 0, 0, 0.7)"; // Ombre plus foncée
    this.ctx.shadowBlur = 15;
    this.ctx.shadowOffsetX = 5;
    this.ctx.shadowOffsetY = 5;
    
    // Dessiner le texte "Game Over" avec bordure
    this.ctx.fillStyle = "white";
    this.ctx.fillText("Game Over", centerX, centerY);
    
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
    
    this.ctx.restore();
  }

  // New method: Draw UI gauges with noise-pattern fill.
  drawUI(ctx) {
    const gaugeWidth = 150;
    const gaugeHeight = 40;
    const padding = 10;
    // Fullness gauge (choose a reddish base color)
    const xFull = padding,
      yFull = padding;
    const fullnessRatio = Math.min(Math.max(this.pet.fullness / 100, 0), 1);
    this.drawGauge(
      ctx,
      xFull,
      yFull,
      gaugeWidth,
      gaugeHeight,
      fullnessRatio,
      this.uiFullSeed,
      { r: 255, g: 102, b: 102 }
    );

    // Happiness gauge (choose a greenish base color)
    const xHappy = padding,
      yHappy = yFull + gaugeHeight + padding;
    const happinessRatio = Math.min(Math.max(this.pet.happiness / 100, 0), 1);
    this.drawGauge(
      ctx,
      xHappy,
      yHappy,
      gaugeWidth,
      gaugeHeight,
      happinessRatio,
      this.uiHappySeed,
      { r: 102, g: 255, b: 102 }
    );
  }

  // Helper method: Draw a single gauge with rounded corners and pattern fill.
  drawGauge(ctx, x, y, gaugeWidth, gaugeHeight, ratio, seed, baseColor) {
    // Create an offscreen canvas for noise texture.
    const off = document.createElement("canvas");
    off.width = gaugeWidth;
    off.height = gaugeHeight;
    const offCtx = off.getContext("2d");
    const imageData = offCtx.createImageData(gaugeWidth, gaugeHeight);
    for (let j = 0; j < gaugeHeight; j++) {
      for (let i = 0; i < gaugeWidth; i++) {
        // Compute noise value using fixed seed.
        const n = noise(i * 0.1 + seed, j * 0.1 + seed, this.uiPerm);
        const offset = Math.floor(n * 20);
        const r = Math.max(Math.min(baseColor.r - offset, 255), 0);
        const g = Math.max(Math.min(baseColor.g - offset, 255), 0);
        const b = Math.max(Math.min(baseColor.b - offset, 255), 0);
        const idx = (j * gaugeWidth + i) * 4;
        imageData.data[idx] = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = 255;
      }
    }
    offCtx.putImageData(imageData, 0, 0);
    const pattern = ctx.createPattern(off, "repeat");

    // Draw gauge outline (rounded rectangle).
    ctx.save();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgb(0, 0, 0)";
    this.roundRect(ctx, x, y, gaugeWidth, gaugeHeight, 10, false, true);
    ctx.restore();

    // Fill gauge: clip filling up to the ratio.
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, gaugeWidth * ratio, gaugeHeight);
    ctx.clip();
    this.roundRect(ctx, x, y, gaugeWidth, gaugeHeight, 10, true, false);
    ctx.fillStyle = pattern;
    ctx.fill();
    ctx.restore();
  }

  roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  drawStartMenu() {
    // Clear canvas with gradient background
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, "rgb(255, 255, 255)");
    gradient.addColorStop(1, "rgb(255, 255, 255)");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Create decorative banner with noise pattern
    const bannerWidth = 460;
    const bannerHeight = 300;
    const bannerX = (this.canvas.width - bannerWidth) / 2;
    const bannerY = (this.canvas.height - bannerHeight) / 2 - 20;
    
    // Create noise pattern for banner
    const bannerSeed = this.uiFullSeed + 100; // Different seed for banner
    const off = document.createElement("canvas");
    off.width = bannerWidth;
    off.height = bannerHeight;
    const offCtx = off.getContext("2d");
    const imageData = offCtx.createImageData(bannerWidth, bannerHeight);
    
    // Gold/yellow base color for the banner
    const baseColor = { r: 255, g: 215, b: 0 };
    
    // Fill the pattern with noise
    for (let j = 0; j < bannerHeight; j++) {
      for (let i = 0; i < bannerWidth; i++) {
        // Compute noise value using fixed seed
        const n = noise(i * 0.01 + bannerSeed, j * 0.01 + bannerSeed, this.uiPerm);
        const offset = Math.floor(n * 30);
        
        // Create a golden texture with noise variations
        const r = Math.max(Math.min(baseColor.r - offset, 255), 0);
        const g = Math.max(Math.min(baseColor.g - offset, 255), 0);
        const b = Math.max(Math.min(baseColor.b - offset, 255), 0);
        
        const idx = (j * bannerWidth + i) * 4;
        imageData.data[idx] = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = 255;
      }
    }
    
    offCtx.putImageData(imageData, 0, 0);
    const pattern = this.ctx.createPattern(off, "repeat");
    
    // Draw decorative banner with pattern
    this.ctx.save();
    
    // Draw banner background with noise pattern
    this.ctx.fillStyle = pattern;
    this.roundRect(this.ctx, bannerX, bannerY, bannerWidth, bannerHeight, 20, true, false);
    
    // Draw ornate border around banner
    this.ctx.lineWidth = 10;
    this.ctx.strokeStyle = "rgb(139, 69, 19)"; // Brown color for border
    this.roundRect(this.ctx, bannerX, bannerY, bannerWidth, bannerHeight, 20, false, true);
    
    // Add inner border with different style
    this.ctx.lineWidth = 5;
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    this.roundRect(this.ctx, bannerX + 15, bannerY + 15, bannerWidth - 30, bannerHeight - 30, 10, false, true);
    
    // Draw decorative corner flourishes
    this.ctx.lineWidth = 6;
    this.ctx.strokeStyle = "rgb(139, 69, 19)";
    
    // Top left flourish
    this.ctx.beginPath();
    this.ctx.moveTo(bannerX + 30, bannerY + 30);
    this.ctx.bezierCurveTo(
      bannerX + 70, bannerY + 20,
      bannerX + 20, bannerY + 70,
      bannerX + 100, bannerY + 50
    );
    this.ctx.stroke();
    
    // Top right flourish
    this.ctx.beginPath();
    this.ctx.moveTo(bannerX + bannerWidth - 30, bannerY + 30);
    this.ctx.bezierCurveTo(
      bannerX + bannerWidth - 70, bannerY + 20,
      bannerX + bannerWidth - 20, bannerY + 70,
      bannerX + bannerWidth - 100, bannerY + 50
    );
    this.ctx.stroke();
    
    // Bottom left flourish
    this.ctx.beginPath();
    this.ctx.moveTo(bannerX + 30, bannerY + bannerHeight - 30);
    this.ctx.bezierCurveTo(
      bannerX + 70, bannerY + bannerHeight - 20,
      bannerX + 20, bannerY + bannerHeight - 70,
      bannerX + 100, bannerY + bannerHeight - 50
    );
    this.ctx.stroke();
    
    // Bottom right flourish
    this.ctx.beginPath();
    this.ctx.moveTo(bannerX + bannerWidth - 30, bannerY + bannerHeight - 30);
    this.ctx.bezierCurveTo(
      bannerX + bannerWidth - 70, bannerY + bannerHeight - 20,
      bannerX + bannerWidth - 20, bannerY + bannerHeight - 70,
      bannerX + bannerWidth - 100, bannerY + bannerHeight - 50
    );
    this.ctx.stroke();
    
    // Draw the text with shadow
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const lineHeight = 80;
    
    // Set text style
    this.ctx.textAlign = "center";
    this.ctx.font = "bold 60px arial";
    
    // Add shadow to text
    this.ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    this.ctx.shadowBlur = 10;
    this.ctx.shadowOffsetX = 5;
    this.ctx.shadowOffsetY = 5;
    
    // Draw text with border
    this.ctx.fillStyle = "white";
    this.ctx.fillText("Press any key", centerX, centerY - lineHeight / 2);
    this.ctx.fillText("to start", centerX, centerY + lineHeight / 2);
    
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
    
    this.ctx.strokeStyle = "black";
    this.ctx.lineWidth = 2;
    this.ctx.strokeText("Press any key", centerX, centerY - lineHeight / 2);
    this.ctx.strokeText("to start", centerX, centerY + lineHeight / 2);
    
    this.ctx.restore();
  }
}
