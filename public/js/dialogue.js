
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


