
// // syntaxe toggle avec condition (fonctionnel)
// document.querySelector("#toggle").addEventListener("click", () => {
//   var settings = document.querySelectorAll(".cible");
//   settings.forEach((setting) => {
//     if (setting.style.display === "block") {setting.style.display = "none";} 
//     else {setting.style.display = "block";}
//   });
// });

// syntaxe vrai toggle 
document.querySelector("#toggle").addEventListener("click", () => {
  var settings = document.querySelectorAll(".cible");
  settings.forEach((setting) => {setting.classList.toggle("hidden");
  });
});

// socket.io
// Initialisation de la connexion Socket.IO avec le destinataire comme query parameter
const socket = io({
  query: {
    destinataire: document.querySelector('input[name="destinataire"]').value
  }
});
const textInput = document.getElementById('textInput');
const sendButton = document.getElementById('sendButton');
const messageBox = document.getElementById('messageBox');

sendButton.addEventListener('click', (e) => {
  e.preventDefault();
  const text = textInput.value;
  socket.emit('sendText', text);
  textInput.value = '';
});

socket.on('receiveText', (data) => {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('d-flex', 'justify-content-end', 'fs-5', 'me-3', 'bg-light', 'pe-2', 'pt-2', 'rounded');
  messageDiv.innerHTML = `
    <p class="text-capitalize fst-italic fw-bold text-info">${data.pseudo} :</p>
    <p class="fw-light text-dark fst-italic ms-2">${data.text}</p>
  `;
  messageBox.prepend(messageDiv);
});






