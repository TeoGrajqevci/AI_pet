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
  
  
  function sendPrompt(text){
  
      const formData = new FormData();
      formData.append("prompt",text);
  
      fetch("http://localhost/set_params", {
        method: "POST",
        body: formData,
      });
  }

// New function to log the master prompt from the DOM.
function logMasterPrompt() {
  const masterPromptEl = document.getElementById("masterPrompt");
  if (masterPromptEl) {
    console.log("Master Prompt:", masterPromptEl.innerText);
  }
}

  function drawCanvas(){
    setTimeout(()=>{
      let canvas = document.getElementById("gameCanvas");
      sendCanvas(canvas)
      logMasterPrompt();
      drawCanvas();
    },1000/20)
  }

  window.onload= ()=>{
    drawCanvas();
  }
