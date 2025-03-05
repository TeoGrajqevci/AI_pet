import { Game } from './game.js';

window.addEventListener('load', () => {
  const canvas = document.getElementById('gameCanvas');
  const game = new Game(canvas);
  game.start();

  let isZoomed = false;
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

  window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    
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
    
    if (key === 'f') {
      // Déclenche l'action "Feed"
      const feedBtn = document.getElementById('feedBtn');
      if (feedBtn && !feedBtn.disabled) feedBtn.click();
    }
    
    if (key === 'p') {
      // Déclenche l'action "Play"
      const playBtn = document.getElementById('playBtn');
      if (playBtn && !playBtn.disabled) playBtn.click();
    }
    
    if (key === '1') {
      // Toggle border blur mode.
      window.borderBlurred = !window.borderBlurred;
    }
  });
});
