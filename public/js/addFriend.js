document.addEventListener("DOMContentLoaded", function() {
  var alertBox = document.getElementById('alert');
  if (alertBox) {
    setTimeout(function() {
      var alert = new bootstrap.Alert(alertBox);
      alert.close();
    }, 3000); 
  }
});