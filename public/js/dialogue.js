document.addEventListener('DOMContentLoaded', () => {

  // Toggle settings visibility
  document.querySelector("#toggle").addEventListener("click", () => {
    const settings = document.querySelectorAll(".cible");
    settings.forEach((setting) => {
      setting.classList.toggle("hidden");
    });
  });


  // Socket.io setup : with appendChild() and  createElement()
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

    if (!data.id) {
      console.error('Message ID is missing:', data); // Log if _id is missing
      return; // Don't proceed if the ID is missing
    }

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

      const editLink = document.createElement('a');
      editLink.href = `/edit-message/${data.id}`;
      editLink.classList.add('btn', 'btn-success', 'btn-sm');
      editLink.innerHTML = '<i class="bi bi-pencil-square"></i>';
      container.appendChild(editLink);

      const deleteForm = document.createElement('form');
      deleteForm.action = `/delete-message/${data.id}?_method=DELETE`;
      deleteForm.method = 'POST';
      container.appendChild(deleteForm);

      const hiddenPseudoInput = document.createElement('input');
      hiddenPseudoInput.type = 'hidden';
      hiddenPseudoInput.name = 'chatting';
      hiddenPseudoInput.value = userPseudo;
      deleteForm.appendChild(hiddenPseudoInput);

      const hiddenMethodInput = document.createElement('input');
      hiddenMethodInput.type = 'hidden';
      hiddenMethodInput.name = '_method';
      hiddenMethodInput.value = 'DELETE';
      deleteForm.appendChild(hiddenMethodInput);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'submit';
      deleteButton.classList.add('btn', 'btn-danger', 'ms-2', 'btn-sm');
      deleteButton.innerHTML = '<i class="bi bi-trash"></i>';
      deleteForm.appendChild(deleteButton);
    } else {
      messageContentDiv.classList.add('justify-content-start', 'bg-info-light', 'ps-2');

      const cibleDiv = document.createElement('div');
      cibleDiv.classList.add('cible', 'hidden', 'align-items-center');
      messageContentDiv.appendChild(cibleDiv);

      const deleteForm = document.createElement('form');
      deleteForm.action = `/delete-message/${data.id}?_method=DELETE`;
      deleteForm.method = 'POST';
      deleteForm.classList.add('d-flex', 'align-items-center');
      cibleDiv.appendChild(deleteForm);

      const hiddenPseudoInput = document.createElement('input');
      hiddenPseudoInput.type = 'hidden';
      hiddenPseudoInput.name = 'chatting';
      hiddenPseudoInput.value = userPseudo;
      deleteForm.appendChild(hiddenPseudoInput);

      const hiddenMethodInput = document.createElement('input');
      hiddenMethodInput.type = 'hidden';
      hiddenMethodInput.name = '_method';
      hiddenMethodInput.value = 'DELETE';
      deleteForm.appendChild(hiddenMethodInput);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'submit';
      deleteButton.classList.add('btn', 'btn-danger', 'btn-sm');
      deleteButton.innerHTML = '<i class="bi bi-trash"></i>';
      deleteForm.appendChild(deleteButton);

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
  }); // socket.io --END--
  
});

  // // Socket.io setup : with inneHTML()
  // const socket = io({
  //   query: {
  //     destinataire: document.querySelector('input[name="destinataire"]').value
  //   }
  // });

  //   const textInput = document.getElementById('textInput');
  //   const sendButton = document.getElementById('sendButton');
  //   const messageBox = document.getElementById('messageBox');

  //   console.log("Current user:", userPseudo); // Log current user for debugging

  //   sendButton.addEventListener('click', (e) => {
  //     e.preventDefault();
  //     const text = textInput.value;
  //     const destinataireElement = document.querySelector('input[name="destinataire"]');
  //     const destinataire = destinataireElement.value.toLowerCase();
  //     console.log('Sending message:', { text, destinataire }); // Log the message being sent
  //     socket.emit('sendText', { text, destinataire });
  //     textInput.value = '';
  //   });

  //   socket.on('receiveText', (data) => {
  //     console.log('Received message:', data);  // Log the received message
  //     const messageDiv = document.createElement('div');
  //     const isCurrentUser = data.pseudo.toLowerCase() === userPseudo;
  //     const isCurrentDestinataire = data.destinataire.toLowerCase() === userPseudo;

  //     console.log('isCurrentUser:', 
  //       isCurrentUser, 'isCurrentDestinataire:', 
  //       isCurrentDestinataire);  // Log comparison results
  //     console.log('check data.id :', data.id); // 

  //     if (!data.id) {
  //       console.error('Message ID is missing:', data); // Log if _id is missing
  //       return; // Don't proceed if the ID is missing
  //     }

  //     if (isCurrentUser || isCurrentDestinataire) {
  //       if (isCurrentUser) {
  //         messageDiv.innerHTML = `
  //           <div class="d-flex justify-content-end align-items-center fs-5 bg-success-light pe-2 gap-2">
  //             <div class="d-flex flex-row gap-2 align-items-center">
  //               <p class="text-capitalize text-success m-2">${data.pseudo} :</p>
  //               <p class="fw-light text-dark m-2">${data.text}</p>
  //             </div>
  //             <div class="cible hidden">
  //               <div class="d-flex justify-content-center">
  //                 <div>
  //                   <a href="/edit-message/${data.id}" class="btn btn-success btn-sm">
  //                     <i class="bi bi-pencil-square"></i>
  //                   </a>
  //                 </div>
  //                 <form action="/delete-message/${data.id}?_method=DELETE" method="POST">
  //                   <input type="hidden" name="pseudo" value="${userPseudo}">
  //                   <input type="hidden" name="_method" value="DELETE">
  //                   <button type="submit" class="btn btn-danger ms-2 btn-sm">
  //                     <i class='bi bi-trash'></i>
  //                   </button>
  //                 </form>
  //               </div>
  //             </div>
  //           </div>
  //         `;
  //       } else {
  //         messageDiv.innerHTML = `
  //           <div class="d-flex fs-5 bg-info-light align-items-center ps-2 gap-2">
  //             <div class="d-flex justify-content-start align-items-center">
  //               <div class="cible hidden">
  //                 <form action="/delete-message/${data.id}?_method=DELETE" method="POST" class="d-flex align-items-center">
  //                   <input type="hidden" name="pseudo" value="${userPseudo}">
  //                   <input type="hidden" name="_method" value="DELETE">
  //                   <button type="submit" class="btn btn-danger btn-sm">
  //                     <i class='bi bi-trash'></i>
  //                   </button>
  //                 </form>
  //               </div>
  //               <div class="d-flex flex-row gap-2 align-items-center">
  //                 <p class="fs-5 text-capitalize text-info m-2">${data.pseudo} :</p>
  //                 <p class="fw-light text-dark m-2">${data.text}</p>
  //               </div>
  //             </div>
  //           </div>
  //         `;
  //       }
  //       const dateSpan = document.createElement('span');
  //       dateSpan.classList.add('fs-6', 'text-muted', 'fw-light');
  //       dateSpan.textContent = data.datetime;

  //       const messageWrapper = document.createElement('div');
  //       messageWrapper.classList.add('text-center', 'fw-bold', 'fst-italic');
  //       messageWrapper.appendChild(dateSpan);
  //       messageWrapper.appendChild(messageDiv);

  //       messageBox.prepend(messageWrapper);
  //       console.log('Message appended to messageBox');
  //     }
  //   }); // socket.io --END--
  // });