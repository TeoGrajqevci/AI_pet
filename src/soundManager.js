export class SoundManager {
  constructor() {
    // Audio element for background music.
    this.musicAudio = new Audio();
    this.musicAudio.loop = true;
  }

  // Plays a sound effect.
  playSfx(url) {
    const sfx = new Audio(url);
    sfx.play();
  }

  // Starts playing background music with error handling.
  playMusic(url, volume = 0.5) {
    this.musicAudio.src = url;
    this.musicAudio.volume = volume;
    const playPromise = this.musicAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.error("Playback prevented. User interaction may be required.", error);
      });
    }
  }

  // Stops the background music.
  stopMusic() {
    this.musicAudio.pause();
    this.musicAudio.currentTime = 0;
  }
}
