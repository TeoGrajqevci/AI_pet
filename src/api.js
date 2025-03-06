// Send canvas to Stream Diffusion
function sendCanvas(canvas) {
    canvas.toBlob((blob) => {
      const formData = new FormData();
      formData.append("image", blob, "canvas.jpeg");
  
      fetch("http://localhost:5000/upload", {
        method: "POST",
        body: formData,
      });
    }, "image/jpeg");
  }
  
  
 export function sendPrompt(text){
  
      const formData = new FormData();
      formData.append("prompt",text);

      formData.append("seed", 12345);
  
      fetch("http://localhost:5000/set_params", {
        method: "POST",
        body: formData,
      });
  }


  function drawCanvas(){
    setTimeout(()=>{
      let canvas = document.getElementById("gameCanvas");
      sendCanvas(canvas)
      drawCanvas();
    },1000/30)
  }

  const feedCanvas = document.getElementById('feedCanvas');
  const ctx = feedCanvas.getContext('2d');
  const feedImg = new Image();
  function updateFeed() {
    feedImg.src = 'http://127.0.0.1:5000/output_feed?dummy=' + Date.now();
    feedImg.onload = () => ctx.drawImage(feedImg, 0, 0, feedCanvas.width, feedCanvas.height);
  }
  setInterval(updateFeed, 1000/30);
  

  window.onload= ()=>{
    drawCanvas();
  }
