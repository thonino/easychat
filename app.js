// For Datetime
function getCurrentDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

//  - - - - - - - - -D E P E N D A N C E S- - - - - - - - - - //

// express & express-session
const express = require('express');
const session = require('express-session');
const app = express();

// bcrypt
const bcrypt = require('bcrypt');

// MongoDB Mongoose et dotenv
require('dotenv').config();
var mongoose = require('mongoose');
const Message = require('./models/Message');
const User = require('./models/User');
const { log } = require('console');
const url = process.env.DATABASE_URL;
mongoose.connect(url, {useNewUrlParser: true,useUnifiedTopology: true})
.then(() => {console.log("MongoDB connected");})
.catch(err => {console.log(err);});

// EJS : 
app.set('view engine', 'ejs');

// BodyParser
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false
}));

// Method-override :
const methodOverride = require('method-override');
app.use(methodOverride('_method'));


// For Datetime
app.locals.getCurrentDateTime = getCurrentDateTime;

//  - - - - - - - - - - R O U T E - - - - - - - - - - - //

// GET HOME
app.get('/', (req, res) => {
  const user = req.session.user;
  res.render('home', { user: user }); 
});

// GET REGISTER
app.get('/register', (req, res) => {
  const user = req.session.user;
  res.render('RegisterForm', { user: user });
});

// POST REGISTER
app.post('/register', function(req, res){
  const userData = new User({
    pseudo: req.body.pseudo,
    email: req.body.email,
    password: bcrypt.hashSync(req.body.password,10),
    role: req.body.role
    })
  userData.save()
    .then(()=>{ res.redirect('/login')})
    .catch((err)=>{console.log(err); 
  });
});

// GET LOGIN
app.get('/login', (req, res) => {const user = req.session.user;
  res.render('LoginForm', { user: user });});

// POST LOGIN
app.post('/login', (req, res) => {
  User.findOne({ pseudo: req.body.pseudo }).then(user => {
    if (!user) {res.send('Pseudo invalide');}
    if (!bcrypt.compareSync(req.body.password, user.password)) {
      res.send('Mot de passe invalide');}
    req.session.user = user;
    res.redirect('/userpage');
  })
  .catch(err => console.log(err));
});

// GET LOGOUT
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {console.log(err);} 
    else {res.redirect('/login');}
  });
});

// GET USER PAGE

app.get('/userpage', (req, res) => {
  if (!req.session.user) { return res.redirect('/login');}
  const user = req.session.user;
  Message.find({$or: [{ expediteur: user.pseudo }, { destinataire: user.pseudo }]
  }).then(messages => {
    const messagesSent = messages.filter(message => message.expediteur === user.pseudo);
    const messagesReceived = messages.filter(message => message.destinataire === user.pseudo);
    res.render('userpage', {  
      user: user, messagesSent: messagesSent,
      messagesReceived: messagesReceived });
  })
  .catch(err => {console.log(err);});
});

// GET NEW MESSAGE
app.get('/message/new', (req, res) => {
  if (!req.session.user) {return res.redirect('/login');}
  const user = req.session.user;
  res.render('messageForm', { user: user });
});

// POST NEW MESSAGE
  app.post('/message', (req, res) => {
    if (!req.session.user) {return res.redirect('/login');}
    const user = req.session.user;
    const messageData = new Message({
      expediteur: user.pseudo,
      destinataire: req.body.destinataire,
      message: req.body.message,
      datetime: new Date()
    });
    messageData.save()
      .then(() => res.redirect('/userpage'))
      .catch(err => {
        console.log(err);
      });
  });

// GET EDIT PAGE 
app.get('/edit-message/:id', (req, res) => {
  const messageId = req.params.id;
  const user = req.session.user;
  Message.findById(messageId)
    .then((message) => {res.render('edit', { message: message , user: user });})
    .catch(err => {console.log(err);});
});

// PUT EDIT PAGE
app.put('/edit-message/:id', (req, res) => {
  const messageId = req.params.id;
  const updatedMessage = {
    destinataire: req.body.destinataire,
    message: req.body.message,
    datetime: new Date()
  };
  Message.findByIdAndUpdate(messageId, updatedMessage)
    .then(() => {res.redirect('/userpage');})
    .catch(err => {console.log(err);});
});

// DELETE 
app.delete('/delete-message/:messageId', (req, res) => {
  Message.findByIdAndRemove(req.params.messageId)
    .then(() => {res.redirect('/userpage');})
    .catch(err => {console.log(err);});
});

// await
// await est utilisé pour attendre la résolution d'une promesse avant de 
// poursuivre l'exécution du code. Lorsqu'une fonction est déclarée avec 
// le mot-clé async, cela signifie qu'elle peut contenir des 
//  opérations asynchrones qui renvoient des promesses.

// $orcls
// Chaque condition spécifiée entre crochets représente une expression 
// de recherche indépendante. Si au moins l'une des conditions est satisfaite, 
// le document correspondant sera retourné dans les résultats de la requête.

// Démarrage du serveur
var server = express(); app.listen(5000, function () {
  console.log("server listening : http://localhost:5000");
});
