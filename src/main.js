import { Game } from './game.js';
import { SoundManager } from './soundManager.js';
import './api.js'

window.addEventListener('load', () => {
  const canvas = document.getElementById('gameCanvas');
  const feedCanvas = document.getElementById('feedCanvas');
  const game = new Game(canvas);
  
  // Créer une instance de SoundManager pour les événements clavier
  const soundManager = new SoundManager();
  
  game.start();

  let isZoomed = false;
  let isFeedZoomed = false;
  
  const controls = document.getElementById('controls');
  const stats = document.getElementById('stats');
  
  // Sauvegarde des styles d'origine du canvas
  const originalStyle = {
    position: canvas.style.position,
    top: canvas.style.top,
    left: canvas.style.left,
    width: canvas.style.width,
    height: canvas.style.height,
  };
  
  // Sauvegarde des styles d'origine du feedCanvas
  const originalFeedStyle = feedCanvas ? {
    position: feedCanvas.style.position,
    top: feedCanvas.style.top,
    left: feedCanvas.style.left,
    width: feedCanvas.style.width,
    height: feedCanvas.style.height,
  } : {};

  // NEW: Default view -> zoomed feedCanvas
  if (feedCanvas) {
    feedCanvas.style.width = '1530px';
    feedCanvas.style.height = '1210px';
    feedCanvas.style.position = 'fixed';
    feedCanvas.style.top = '50%';
    feedCanvas.style.left = '50%';
    feedCanvas.style.transform = 'translate(-51%, -51%)';
    canvas.style.display = 'none';
    const controls = document.getElementById('controls');
    const masterPrompt = document.getElementById('masterPrompt');
    if (controls) controls.style.display = 'none';
    if (masterPrompt) masterPrompt.style.display = 'none';
    isFeedZoomed = true;
  }

  window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    
    // If game over and key is 'b' or 'r', reload the page.
    if (game.gameOver && (key === 'b' || 'r')) {
      location.reload();
      return;
    }
    
    if (key === 'd') {
      if (!isZoomed) {
        // Calcul du ratio du canvas
        const aspectRatio = canvas.width / canvas.height;
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        let newWidth, newHeight;
        if (winW / winH >= aspectRatio) {
          newHeight = winH;
          newWidth = newHeight * aspectRatio;
        } else {
          newWidth = winW;
          newHeight = newWidth / aspectRatio;
        }
        // Appliquer le style pour centrer le canvas et garder son ratio
        canvas.style.cursor = 'none';
        canvas.style.position = 'fixed';
        canvas.style.width = newWidth + 'px';
        canvas.style.height = newHeight + 'px';
        canvas.style.top = ((winH - newHeight) / 2) + 'px';
        canvas.style.left = ((winW - newWidth) / 2) + 'px';
        if (controls) controls.style.display = 'none';
        if (stats) stats.style.display = 'none';
      } else {
        // Rétablir la vue initiale
        canvas.style.cursor = 'auto';
        canvas.style.position = originalStyle.position;
        canvas.style.top = originalStyle.top;
        canvas.style.left = originalStyle.left;
        canvas.style.width = originalStyle.width;
        canvas.style.height = originalStyle.height;
        if (controls) controls.style.display = 'block';
        if (stats) stats.style.display = 'block';
      }
      isZoomed = !isZoomed;
    }
    
    if (key === 'a' && feedCanvas) {
      // Modified: Resize feedCanvas to 1280x960, hide gameCanvas, buttons, and prompt when not zoomed.
      if (!isFeedZoomed) {
        feedCanvas.style.width = '1530px';
        feedCanvas.style.height = '1210px';
        

        feedCanvas.style.position = 'fixed';
        feedCanvas.style.top = '50%';
        feedCanvas.style.left = '50%';
        feedCanvas.style.transform = 'translate(-51%, -51%)';
        canvas.style.display = 'none';
        // Hide controls and master prompt.
        const controls = document.getElementById('controls');
        const masterPrompt = document.getElementById('masterPrompt');
        if (controls) controls.style.display = 'none';
        if (masterPrompt) masterPrompt.style.display = 'none';
      } else {
        // Revert to original styles.
        feedCanvas.style.width = originalFeedStyle.width;
        feedCanvas.style.height = originalFeedStyle.height;
        feedCanvas.style.position = originalFeedStyle.position;
        feedCanvas.style.top = originalFeedStyle.top;
        feedCanvas.style.left = originalFeedStyle.left;
        feedCanvas.style.transform = '';
        canvas.style.display = 'block';
        // Show controls and master prompt.
        const controls = document.getElementById('controls');
        const masterPrompt = document.getElementById('masterPrompt');
        if (controls) controls.style.display = 'block';
        if (masterPrompt) masterPrompt.style.display = 'block';
      }
      isFeedZoomed = !isFeedZoomed;
    }
    
    if (key === 'b') {
      // Vérifier si c'est la première pression de la touche "b" après le démarrage du jeu
      if (!game.firstBKeyPressed) {
        // Définir l'indicateur à true pour indiquer que la première touche a été pressée
        game.firstBKeyPressed = true;
        // Jouer le son mais ne pas générer de nourriture
        soundManager.playSfx("./assets/spawn-food.mp3");
      } else {
        // Ce n'est pas la première pression, donc générer de la nourriture
        const feedBtn = document.getElementById('feedBtn');
        if (feedBtn && !feedBtn.disabled){
          soundManager.playSfx("./assets/spawn-food.mp3");
          feedBtn.click();
        } 
      }
    }
    
    if (key === 'r') {
      // Jouer le son de jeu une seule fois
      
      // Déclenche l'action "Play"
      const playBtn = document.getElementById('playBtn');
      if (playBtn && !playBtn.disabled){
        soundManager.playSfx("./assets/spawn-food.mp3");
        playBtn.click();
      } 
    }
    
    if (key === '1') {
      // Toggle border blur mode.
      window.borderBlurred = !window.borderBlurred;
    }
  });
});
