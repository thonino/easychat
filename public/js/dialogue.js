document.addEventListener('DOMContentLoaded', () => {

  document.querySelector("#toggle").addEventListener("click", () => {
    const settings = document.querySelectorAll(".cible");
    settings.forEach((setting) => {
      setting.classList.toggle("hidden");
    });
  });

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
    const textTrim = text.trim();

    if (textTrim === '') {
      alert('Le champ ne peut pas être vide');
      return;
    }

    console.log('Envoie du message: ', { text, destinataire });
    socket.emit('sendText', { text, destinataire });
    textInput.value = '';
  });

  socket.on('receiveText', (data) => {
    console.log('Received message:', data);
    const isCurrentUser = data.pseudo.toLowerCase() === userPseudo;
    const isCurrentDestinataire = data.destinataire.toLowerCase() === userPseudo;
    const isChattingWith = document.querySelector('input[name="destinataire"]').value.toLowerCase() === data.pseudo.toLowerCase();

    console.log(
      'isCurrentUser: ', isCurrentUser,
      'isCurrentDestinataire: ', isCurrentDestinataire,
      'isChattingWith: ', isChattingWith
    );

    if (!data.id) {
      console.error('Message ID is missing:', data);
      return;
    }

    if (!isCurrentUser && !isCurrentDestinataire && !isChattingWith) {
      return;
    }

const messageWrapper = document.createElement('div');
messageWrapper.classList.add('text-center', 'fw-bold', 'fst-italic', 'mt-3');

const dateSpan = document.createElement('span');
dateSpan.classList.add('fs-6', 'text-muted', 'fw-light', 'cible', 'hidden');
dateSpan.textContent = data.datetime;
messageWrapper.appendChild(dateSpan);

if (isCurrentUser) {
  const messageContentDiv2 = document.createElement('div');
  messageContentDiv2.classList.add('d-flex', 'justify-content-end');
  messageWrapper.appendChild(messageContentDiv2);

  const messageContentDiv = document.createElement('div');
  messageContentDiv.classList.add(
    'd-flex', 'justify-content-end', 'align-items-center', 'fs-5',
    'bg-primary', 'gap-2', 'mw-85', 'round-msg', 'me-2', 'px-2'
  );
  messageContentDiv2.appendChild(messageContentDiv);

  const contentDivExpediteur = document.createElement('div');
  contentDivExpediteur.classList.add('d-flex', 'justify-content-center', 'align-items-center', 'gap-2', 'm-2');
  messageContentDiv.appendChild(contentDivExpediteur);

  const messageParagraph = document.createElement('p');
  messageParagraph.classList.add('fw-light', 'text-center', 'text-light', 'm-0', 'p-0');
  messageParagraph.textContent = data.text;
  contentDivExpediteur.appendChild(messageParagraph);

  const profileImg = document.createElement('img');
  profileImg.src = `/uploads/${data.expediteurPhoto}`;
  profileImg.classList.add('card-img-top', 'round', 'wh-25');
  profileImg.alt = 'img profile';
  contentDivExpediteur.appendChild(profileImg);

  const cibleDiv = document.createElement('div');
  cibleDiv.classList.add('cible', 'hidden', 'me-2');
  messageContentDiv.appendChild(cibleDiv);

  const container = document.createElement('div');
  container.classList.add('d-flex', 'justify-content-center', 'align-items-center');
  cibleDiv.appendChild(container);

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.classList.add('btn', 'btn-success', 'btn-sm');
  editButton.setAttribute('data-bs-toggle', 'modal');
  editButton.setAttribute('data-bs-target', `#editMessageModal${data.id}`);

  const editIcon = document.createElement('i');
  editIcon.classList.add('bi', 'bi-pencil-square');
  editButton.appendChild(editIcon);

  container.appendChild(editButton);

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.classList.add('btn', 'btn-danger', 'btn-sm', 'ms-2');
  deleteButton.setAttribute('data-bs-toggle', 'modal');
  deleteButton.setAttribute('data-bs-target', `#deleteMessageModal${data.id}`);

  const deleteIcon = document.createElement('i');
  deleteIcon.classList.add('bi', 'bi-trash');
  deleteButton.appendChild(deleteIcon);

  container.appendChild(deleteButton);

} else {
  const messageContentDiv2 = document.createElement('div');
  messageContentDiv2.classList.add('d-flex', 'justify-content-start');
  messageWrapper.appendChild(messageContentDiv2);

  const messageContentDiv = document.createElement('div');
  messageContentDiv.classList.add(
    'd-flex', 'justify-content-start', 'align-items-center', 'fs-5',
    'bg-info', 'gap-2', 'mw-85', 'round-msg', 'ms-2', 'px-2'
  );
  messageContentDiv2.appendChild(messageContentDiv);

  const contentDivDestinataire = document.createElement('div');
  contentDivDestinataire.classList.add('d-flex', 'justify-content-start', 'align-items-center', 'gap-2', 'm-2');
  messageContentDiv.appendChild(contentDivDestinataire);

  const cibleDiv = document.createElement('div');
  cibleDiv.classList.add('cible', 'hidden', 'align-items-center');
  contentDivDestinataire.appendChild(cibleDiv);

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.classList.add('btn', 'btn-danger', 'btn-sm');
  deleteButton.setAttribute('data-bs-toggle', 'modal');
  deleteButton.setAttribute('data-bs-target', `#deleteMessageModal${data.id}`);

  const deleteIcon = document.createElement('i');
  deleteIcon.classList.add('bi', 'bi-trash');
  deleteButton.appendChild(deleteIcon);

  cibleDiv.appendChild(deleteButton);

  const profileImg = document.createElement('img');
  profileImg.src = `/uploads/${data.expediteurPhoto}`;
  profileImg.classList.add('card-img-top', 'round', 'wh-25');
  profileImg.alt = 'img profile';
  contentDivDestinataire.appendChild(profileImg);

  const messageParagraph = document.createElement('p');
  messageParagraph.classList.add('fw-light', 'text-center', 'text-light', 'm-0', 'p-0');
  messageParagraph.textContent = data.text;
  contentDivDestinataire.appendChild(messageParagraph);
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
    `

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
