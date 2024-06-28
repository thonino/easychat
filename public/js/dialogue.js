
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
const socket = io({
  query: {
    destinataire: document.querySelector('input[name="destinataire"]').value
  }
});

// Références 
const textInput = document.getElementById('textInput');
const sendButton = document.getElementById('sendButton');
const messageBox = document.getElementById('messageBox');

const userElement = document.querySelector('.fw-bold.text-capitalize.fst-italic.text-info');
const userName = userElement.innerText.split(' ')[0];
const currentUser = userName.toLowerCase();

// envoyer un message
const sendMessage = (e) => {
  e.preventDefault();
  const text = textInput.value;
  const destinataireElement = document.querySelector('input[name="destinataire"]');
  const destinataire = destinataireElement.value.toLowerCase();
  socket.emit('sendText', { text, destinataire });
  textInput.value = '';
};

// recevoiressages
const displayMessage = (data) => {
  const messageDiv = document.createElement('div');
  const isCurrentUser = data.pseudo.toLowerCase() === currentUser;
  const isCurrentDestinataire = data.destinataire.toLowerCase() === currentUser;

  if (isCurrentUser || isCurrentDestinataire) {
    const alignmentClass = isCurrentUser ? 'justify-content-end' : 'justify-content-start';
    const textColorClass = isCurrentUser ? 'text-info' : 'text-success';
    messageDiv.classList.add('text-center', 'fw-bold', 'fst-italic');
    messageDiv.innerHTML = `
      <span class="fs-6 text-muted fw-light">${data.datetime}</span>
      <div class="d-flex ${alignmentClass} fs-5 me-3 bg-light pe-2 pt-2 rounded">
        <p class="text-capitalize ${textColorClass}">${data.pseudo} :</p>
        <p class="fw-light text-dark ms-2">${data.text}</p>
      </div>
    `;
    messageBox.prepend(messageDiv);
  }
};


sendButton.addEventListener('click', sendMessage); // Écoute le bouton submit
socket.on('receiveText', displayMessage); // Écoute les messages reçus











