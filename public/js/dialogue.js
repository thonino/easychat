document.addEventListener('DOMContentLoaded', () => {

  // Toggle settings visibility
  document.querySelector("#toggle").addEventListener("click", () => {
    const settings = document.querySelectorAll(".cible");
    settings.forEach((setting) => {
      setting.classList.toggle("hidden");
    })
  });
  // 

// Socket.io setup 
const socket = io({
  query: {
    destinataire: document.querySelector('input[name="destinataire"]').value
  }
});

const textInput = document.getElementById('textInput');
const sendButton = document.getElementById('sendButton');
const messageBox = document.getElementById('messageBox');

console.log("Utilisateur actuel: ", userPseudo); 

sendButton.addEventListener('click', (e) => {
  e.preventDefault();
  const destinataireElement = document.querySelector('input[name="destinataire"]');
  const destinataire = destinataireElement.value.toLowerCase();
  const text = textInput.value; 
  const texTrim = text.trim(); 

  // Vérification côté client
  if (texTrim === '') { alert('Le champ ne peut pas être vide'); return; 
  }

  console.log('Envoie du message: ', { text, destinataire }); 
  socket.emit('sendText', { text, destinataire });
  textInput.value = '';
});

socket.on('receiveText', (data) => {
  console.log('Received message:', data);  // Log the received message
  const isCurrentUser = data.pseudo.toLowerCase() === userPseudo;
  const isCurrentDestinataire = data.destinataire.toLowerCase() === userPseudo;
  const isChattingWith = document.querySelector('input[name="destinataire"]').value.toLowerCase() === data.pseudo.toLowerCase();

  console.log(
    'isCurrentUser: ', isCurrentUser, 
    'isCurrentDestinataire: ', isCurrentDestinataire, 
    'isChattingWith: ', isChattingWith
  );  

  if (!data.id) {
    console.error('Message ID is missing:', data); // Log if _id is missing
    return; // Don't proceed if the ID is missing
  }

  // Uniquement user a ouvert l chat
  if (!isCurrentUser && !isCurrentDestinataire && !isChattingWith) {  return;   }

    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('text-center', 'fw-bold', 'fst-italic');

    const dateSpan = document.createElement('span');
    dateSpan.classList.add('fs-6', 'text-muted', 'fw-light');
    dateSpan.textContent = data.datetime;
    messageWrapper.appendChild(dateSpan);

    const messageContentDiv = document.createElement('div');
    messageContentDiv.classList.add('d-flex', 'fs-5', 'gap-2', 'align-items-center');
    messageWrapper.appendChild(messageContentDiv);

    if (isCurrentUser) {
      messageContentDiv.classList.add('justify-content-end', 'bg-success-light', 'pe-2');

      const pseudoParagraph = document.createElement('p');
      pseudoParagraph.classList.add('text-capitalize', 'text-success', 'm-2');
      pseudoParagraph.textContent = `${data.pseudo} :`;
      messageContentDiv.appendChild(pseudoParagraph);

      const messageParagraph = document.createElement('p');
      messageParagraph.classList.add('fw-light', 'text-dark', 'm-2');
      messageParagraph.textContent = data.text;
      messageContentDiv.appendChild(messageParagraph);

      const cibleDiv = document.createElement('div');
      cibleDiv.classList.add('cible', 'hidden');
      messageContentDiv.appendChild(cibleDiv);

      const container = document.createElement('div');
      container.classList.add('d-flex','justify-content-center');
      cibleDiv.appendChild(container);

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.classList.add('btn', 'btn-success', 'btn-sm');
      editButton.setAttribute('data-bs-toggle', 'modal');
      editButton.setAttribute('data-bs-target', `#editMessageModal${data.id}`);
      editButton.innerHTML = '<i class="bi bi-pencil-square"></i>';
      container.appendChild(editButton);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.classList.add('btn', 'btn-danger', 'btn-sm', 'ms-2');
      deleteButton.setAttribute('data-bs-toggle', 'modal');
      deleteButton.setAttribute('data-bs-target', `#deleteMessageModal${data.id}`);
      deleteButton.innerHTML = '<i class="bi bi-trash"></i>';
      container.appendChild(deleteButton);
    } else {
      messageContentDiv.classList.add('justify-content-start', 'bg-info-light', 'ps-2');

      const cibleDiv = document.createElement('div');
      cibleDiv.classList.add('cible', 'hidden', 'align-items-center');
      messageContentDiv.appendChild(cibleDiv);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.classList.add('btn', 'btn-danger', 'btn-sm', 'ms-2');
      deleteButton.setAttribute('data-bs-toggle', 'modal');
      deleteButton.setAttribute('data-bs-target', `#deleteMessageModal${data.id}`);
      deleteButton.innerHTML = '<i class="bi bi-trash"></i>';
      cibleDiv.appendChild(deleteButton);

      const pseudoParagraph = document.createElement('p');
      pseudoParagraph.classList.add('fs-5', 'text-capitalize', 'text-info', 'm-2');
      pseudoParagraph.textContent = `${data.pseudo} :`;
      messageContentDiv.appendChild(pseudoParagraph);

      const messageParagraph = document.createElement('p');
      messageParagraph.classList.add('fw-light', 'text-dark', 'm-2');
      messageParagraph.textContent = data.text;
      messageContentDiv.appendChild(messageParagraph);
    }

    messageBox.prepend(messageWrapper);
    console.log('Message appended to messageBox');

    // Create the edit modal
    const editModal = document.createElement('div');
    editModal.classList.add('modal', 'fade');
    editModal.id = `editMessageModal${data.id}`;
    editModal.setAttribute('tabindex', '-1');
    editModal.setAttribute('aria-labelledby', `editMessageModalLabel${data.id}`);
    editModal.setAttribute('aria-hidden', 'true');
    editModal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header bg-success-light">
            <h5 class="modal-title" id="editMessageModalLabel${data.id}">Modifier Message</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <form action="/edit-message/${data.id}?_method=PUT" method="POST">
              <input type="hidden" name="_method" value="PUT">
              <input type="hidden" name="destinataire" value="${data.destinataire}">
              <div class="form-group">
                <label for="message" class="mb-2 text-capitalize"> à : 
                  <span class="fw-bold text-info">${data.destinataire}</span>
                </label>
                <textarea class="form-control bg-info-light" name="message" rows="4" required>${data.text}</textarea>
              </div>
              <input type="hidden" name="datetime" value="${data.datetime}">
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
                <button type="submit" class="btn btn-success">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    // Create the delete modal
    const deleteModal = document.createElement('div');
    deleteModal.classList.add('modal', 'fade');
    deleteModal.id = `deleteMessageModal${data.id}`;
    deleteModal.setAttribute('tabindex', '-1');
    deleteModal.setAttribute('aria-labelledby', `deleteMessageModalLabel${data.id}`);
    deleteModal.setAttribute('aria-hidden', 'true');
    deleteModal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header bg-danger-light">
            <h5 class="modal-title" id="deleteMessageModalLabel${data.id}">Supprimer Message</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <form action="/delete-message/${data.id}?_method=DELETE" method="POST">
              <input type="hidden" name="_method" value="DELETE">
              <input type="hidden" name="chatting" value="${userPseudo}">
              <p>Êtes-vous sûr de vouloir supprimer ce message ?</p>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
                <button type="submit" class="btn btn-danger">Supprimer</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    const modalsContainer = document.getElementById('modalsContainer');
    modalsContainer.appendChild(editModal);
    modalsContainer.appendChild(deleteModal);
  });
});
