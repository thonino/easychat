function confirmDeleteFriend(data) {
  if (confirm(`Etes-vous sûr de vouloir supprimer ${data}`)) {
    document.getElementById(`deleteFriend${data}`).submit();
  }
}