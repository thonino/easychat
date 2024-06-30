document.addEventListener('DOMContentLoaded', () => {
  // Toggle settings visibility
  document.querySelector("#toggle").addEventListener("click", () => {
    const settings = document.querySelectorAll(".cible");
    settings.forEach((setting) => {
      setting.classList.toggle("hidden");
    });
  });

  // Socket.io setup
  const socket = io({
    query: {
      destinataire: document.querySelector('input[name="destinataire"]').value
    }
  });

  const textInput = document.getElementById('textInput');
  const sendButton = document.getElementById('sendButton');
  const messageBox = document.getElementById('messageBox');

  console.log("Current user:", userPseudo); // Log current user for debugging

  sendButton.addEventListener('click', (e) => {
    e.preventDefault();
    const text = textInput.value;
    const destinataireElement = document.querySelector('input[name="destinataire"]');
    const destinataire = destinataireElement.value.toLowerCase();
    console.log('Sending message:', { text, destinataire }); // Log the message being sent
    socket.emit('sendText', { text, destinataire });
    textInput.value = '';
  });

  socket.on('receiveText', (data) => {
    console.log('Received message:', data);  // Log the received message
    const messageDiv = document.createElement('div');
    const isCurrentUser = data.pseudo.toLowerCase() === userPseudo;
    const isCurrentDestinataire = data.destinataire.toLowerCase() === userPseudo;

    console.log('isCurrentUser:', isCurrentUser, 'isCurrentDestinataire:', isCurrentDestinataire);  // Log comparison results

    if (isCurrentUser || isCurrentDestinataire) {
      if (isCurrentUser) {
        messageDiv.innerHTML = `
          <div class="d-flex justify-content-end align-items-center fs-5 bg-success-light pe-2 gap-2">
            <div class="d-flex flex-row gap-2 align-items-center">
              <p class="text-capitalize text-success m-2">${data.pseudo} :</p>
              <p class="fw-light text-dark m-2">${data.text}</p>
            </div>
            <div class="cible hidden">
              <div class="d-flex justify-content-center">
                <div>
                  <a href="/edit-message/${data._id}" class="btn btn-success btn-sm">
                    <i class="bi bi-pencil-square"></i>
                  </a>
                </div>
                <form action="/delete-message/${data._id}?_method=DELETE" method="POST">
                  <input type="hidden" name="pseudo" value="${userPseudo}">
                  <input type="hidden" name="_method" value="DELETE">
                  <button type="submit" class="btn btn-danger ms-2 btn-sm">
                    <i class='bi bi-trash'></i>
                  </button>
                </form>
              </div>
            </div>
          </div>
        `;
      } else {
        messageDiv.innerHTML = `
          <div class="d-flex fs-5 bg-info-light align-items-center ps-2 gap-2">
            <div class="d-flex justify-content-start align-items-center">
              <div class="cible hidden">
                <form action="/delete-message/${data._id}?_method=DELETE" method="POST" class="d-flex align-items-center">
                  <input type="hidden" name="pseudo" value="${userPseudo}">
                  <input type="hidden" name="_method" value="DELETE">
                  <button type="submit" class="btn btn-danger btn-sm">
                    <i class='bi bi-trash'></i>
                  </button>
                </form>
              </div>
              <div class="d-flex flex-row gap-2 align-items-center">
                <p class="fs-5 text-capitalize text-info m-2">${data.pseudo} :</p>
                <p class="fw-light text-dark m-2">${data.text}</p>
              </div>
            </div>
          </div>
        `;
      }
      const dateSpan = document.createElement('span');
      dateSpan.classList.add('fs-6', 'text-muted', 'fw-light');
      dateSpan.textContent = data.datetime;

      const messageWrapper = document.createElement('div');
      messageWrapper.classList.add('text-center', 'fw-bold', 'fst-italic');
      messageWrapper.appendChild(dateSpan);
      messageWrapper.appendChild(messageDiv);

      messageBox.prepend(messageWrapper);
      console.log('Message appended to messageBox');
    }
  });
});
