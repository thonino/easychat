const express = require('express');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const sharedSession = require('express-socket.io-session');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const mongoose = require('mongoose');
const moment = require('moment');
const bcrypt = require('bcrypt');
require('dotenv').config();

const Message = require('./models/Message');
const User = require('./models/User');
const Friend = require('./models/Friend');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const sessionMiddleware = session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
});

mongoose.connect(
  process.env.DATABASE_URL, { useNewUrlParser: true, useUnifiedTopology: true }
)
  .then(() => { console.log("MongoDB connected"); })
  .catch(err => { console.log(err); });

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(methodOverride('_method'));
app.use(sessionMiddleware);
app.use('/public', express.static('public'));
io.use(sharedSession(sessionMiddleware, { autoSave: true }));

// Socket.IO: Écouter connexions
io.on('connection', (socket) => {
  const user = socket.handshake.session.user;
  const chattingWith = socket.handshake.session.chatting;
  if (user) {
    console.log(`${user.pseudo} a ouvert le chat pour : ${chattingWith}`);
    // Joindre les salles de chat avec les noms d'utilisateur en minuscules
    const room1 = `${user.pseudo.toLowerCase()}-${chattingWith.toLowerCase()}`;
    const room2 = `${chattingWith.toLowerCase()}-${user.pseudo.toLowerCase()}`;
    socket.join(room1);
    socket.join(room2);
    // Écouter messages
    socket.on('sendText', async ({ text }) => {
      const heure = moment().format('h:mm:ss');
      const newMessage = new Message({
        expediteur: user.pseudo.toLowerCase(),
        destinataire: chattingWith.toLowerCase(),
        message: text,
        datetime: heure
      });
      try {
        const savedMessage = await newMessage.save();
        console.log(`
          Texte: ${newMessage.message} 
          De: ${newMessage.expediteur} 
          A: ${newMessage.destinataire}`
        );
        // Afficher message dans le chat du destinataire
        const friend = await Friend.findOne({
          $or: [
            { adder: user.pseudo, asked: chattingWith },
            { adder: chattingWith, asked: user.pseudo }
          ]
        });
        if (friend) {
          if (friend.chat.length === 1) {
            friend.chat.push(chattingWith);
            await friend.save();
          }
        }
        io.to(`${newMessage.expediteur}-${newMessage.destinataire}`)
          .to(`${newMessage.destinataire}-${newMessage.expediteur}`)
          .emit('receiveText', {
            id: savedMessage._id,
            pseudo: newMessage.expediteur,
            text: text,
            destinataire: newMessage.destinataire,
            datetime: heure
          });
      } catch (err) {
        console.log(err);
        console.error("Erreur messaage ou de MAJ friend:", err);
      }
    });
    socket.on('disconnect', () => {
      console.log(`${user.pseudo} : logout`);
    });
  }
});

// Message d'alerte
app.use((req, res, next) => {
  res.locals.confirm = req.session.confirm;
  res.locals.alertType = req.session.alertType;
  delete req.session.confirm;
  delete req.session.alertType;
  next();
});

// Rendre disponible pour tous
const makeAvailable = async (req, res, next) => {
  try {
    const user = req.session.user;
    let userPublicList = [];
    let friends = [];
    let chats = [];
    let friendsReceived = [];
    let friendsSend = [];

    if (user) {
      userPublicList = await User.find();
      
      const allFriends = await Friend.find();

      // Filtre tous les utilisateurs amis
      friends = allFriends.filter(friend => { 
        return friend.confirm === true &&
              (friend.adder === user.pseudo || friend.asked === user.pseudo);
      });

      // Filtrer utilisateur qui chattent avec user.pseudo
      chats = friends.filter(friend => friend.chat && friend.chat.includes(user.pseudo));
      
      // Garde "adder/asker" different de user.pseudo => crée liste amis
      friends = friends.map(friend => friend.adder === user.pseudo ? friend.asked : friend.adder);

      // Garde "adder/asker" different de user.pseudo => crée liste amis
      chats = chats.map(friend => friend.adder === user.pseudo ? friend.asked : friend.adder);

      // Filtre demandes reçues
      friendsReceived = allFriends
        .filter(friend => friend.confirm === false && friend.asked === user.pseudo)
        .map(friend => friend.adder);

      // Filtre demandes envoyées
      friendsSend = allFriends
        .filter(friend => friend.confirm === false && friend.adder === user.pseudo)
        .map(friend => friend.asked);

      // Filtrer les utilisateurs disponibles par pseudo
      userPublicList = userPublicList.filter(data => data.status === true);
      userPublicList = userPublicList.filter(data => !friends.includes(data.pseudo));
      userPublicList = userPublicList.filter(data => !friendsReceived.includes(data.pseudo));
      userPublicList = userPublicList.filter(data => !friendsSend.includes(data.pseudo));
      userPublicList = userPublicList.filter(data => data.pseudo !== user.pseudo);
    }

    res.locals.user = user;
    res.locals.userPublicList = userPublicList;
    res.locals.friends = friends;
    res.locals.friendsReceived = friendsReceived;
    res.locals.friendsSend = friendsSend;
    res.locals.chats = chats;

    next();
  } catch (err) {
    console.error("Erreur => makeAvaible :", err);
    res.render("error", { message: "Erreur => makeAvaible" });
  }
};

app.use(makeAvailable);

//---------------------------------------ROOTS---------------------------------------//

// Index
app.get('/', (req, res) => {
  const user = req.session.user;
  const heure = moment().format('DD-MM-YYYY, h:mm:ss');
  res.render('home', { user: user, heure: heure });
});

// Get register
app.get('/register', (req, res) => {
  const user = req.session.user;
  res.render('RegisterForm', { user: user });
});

// Post register
app.post('/register', function (req, res) {
  const userData = new User({
    pseudo: req.body.pseudo,
    email: req.body.email,
    password: bcrypt.hashSync(req.body.password, 10),
    role: req.body.role
  });
  userData.save()
    .then(() => { res.redirect('/login') })
    .catch((err) => { console.log(err); });
});

// Get login
app.get('/login', (req, res) => {
  const user = req.session.user;
  res.render('LoginForm', { user: user });
});

// Post login
app.post('/login', (req, res) => {
  User.findOne({ pseudo: req.body.pseudo }).then(user => {
    if (!user) { res.send('Pseudo invalide'); }
    if (!bcrypt.compareSync(req.body.password, user.password)) {
      res.send('Mot de passe invalide');
    }
    req.session.user = user;
    res.redirect('/userpage');
  })
    .catch(err => console.log(err));
});

// Get logout
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) { console.log(err); }
    else { res.redirect('/login'); }
  });
});

// Get userpage
app.get('/userpage', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  const user = req.session.user;
  const friends = res.locals.friends;
  const friendsReceived = res.locals.friendsReceived;
  const friendsSend = res.locals.friendsSend;
  const chats = res.locals.chats; 
  res.render('userpage', {
    user: res.locals.user,
    contacts: res.locals.contacts,
    userPublicList: res.locals.userPublicList,
    chatting: res.locals.chatting,
    user,
    friends,
    friendsReceived,
    friendsSend,
    chats
  });
});

// Create new chat
app.post('/chat', async (req, res) => {
  try {
    const user = req.session.user;
    const destinataire = req.body.destinataire;

    // Cibler friend
    const friend = await Friend.findOne({
      $or: [
        { adder: user.pseudo, asked: destinataire },
        { adder: destinataire, asked: user.pseudo }
      ]
    });

    // Initialiser le tableau chat s'il n'existe pas
    if (!friend.chat) {
      friend.chat = [];
    }

    // Ajouter user.pseudo si nécessaire
    if (!friend.chat.includes(user.pseudo) && friend.chat.length < 2) {
      friend.chat.push(user.pseudo);
    }

    // Sauvegarder les modifications
    await friend.save();

    res.redirect(`/dialogue/${destinataire}`);
  } catch (err) {
    console.log(err);
    res.redirect('/error');
  }
});


// Archiver discussion 
app.post('/archive', async (req, res) => {
  try {
    const user = req.session.user;
    const destinataire = req.body.destinataire;
    console.log(`${user.pseudo} a archivé son chat avec : ${destinataire}`);
    // Cibler friend
    const friend = await Friend.findOne({
      $or: [
        { adder: user.pseudo, asked: destinataire },
        { adder: destinataire, asked: user.pseudo }
      ]
    });
    // Retirer user.pseudo du tableau
    friend.chat = friend.chat.filter(data => data !== user.pseudo);
    await friend.save(); 
    res.redirect(`/userpage`);
  } 
  catch (err) { console.log(err); res.redirect('/error'); }
});

// Get addfriend
app.get('/addfriend', (req, res) => {
  if (!req.session.user) { return res.redirect('/login'); }
  const user = req.session.user;
  const status = user.status; 
  let state; let color;
  // Déterminer l'état en fonction du statut
  if (status === true) { state = "visible";  color = "text-success" } 
  else { state = "invisible";  color = "text-danger" }
  res.render('AddFriend', {
    user, status, state, color,
    userPublicList: res.locals.userPublicList,
    chatting: res.locals.chatting,
    friends: res.locals.friends,
    friendsAsk: res.locals.friendsAsk,
    chats: res.locals.chats,
  });
});

// Post status
app.post('/status', (req, res) => {
  if (!req.session.user) { return res.redirect('/login'); }
  const user = req.session.user;
  const status = req.body.status;
  let state;
  // Convertir le statut en booléen
  if (status === "true") { state = true; } 
  else if (status === "false") { state = false; }
  User.findOneAndUpdate(
    { _id: user._id }, // Cibler user
    { status: state }, // Mettre à jour status
    { new: true } // Retourner le document
  )
  .then((updatedUser) => {
    console.log("Le statut de ",user.pseudo, ' devient: ',state);
    // Mettre à jour la session user
    req.session.user = updatedUser;
    res.redirect('/addfriend');
  })
  .catch((err) => {
    console.error('Erreur de mise à jour:', err);
    res.redirect('/error');
  });
});


// Post sendrequest
app.post('/sendrequest', (req, res) => {
  if (!req.session.user){ return res.redirect('/login'); }
  const adder = req.body.adder;
  const asked = req.body.asked;
  if (adder && asked) {
    const addFriend = new Friend({adder: adder, asked: asked});
    addFriend.save()
    .then(() => {
      req.session.confirm = `Demande d'ami envoyée à ${asked}`;
      req.session.alertType = 'success';
      res.redirect('/addfriend');
    })
    .catch((err) => { console.log(err); });
  }
});

// Post agree
app.post('/agree', (req, res) => {
  if (!req.session.user){ return res.redirect('/login'); }
  const user = req.session.user;
  const adder = req.body.adder;
  const asked = user.pseudo;
  Friend.findOneAndUpdate({ adder, asked, confirm: false }, { confirm: true })
  .then(() => {
    req.session.confirm = `Vous avez accepté : ${adder}`;
    req.session.alertType = 'success';
    res.redirect('/addfriend');
  })
  .catch(err => { console.log(err); res.redirect('/error'); });
});

// Post remove or decline
app.post('/remove/:element', (req, res) => {
  if (!req.session.user){ return res.redirect('/login'); }
  const element = req.params.element;
  let action = "";
  if (element === "disagree") { action = "refusé : ";} 
  else  { action = "supprimé : "; }
  const user = req.session.user;
  const adder = req.body.adder;
  const asked = user.pseudo;
  Friend.findOneAndRemove({
    $or: [
      { adder, asked },
      { adder: asked, asked: adder }
    ]
  })
  .then(() => {
    req.session.confirm = `Vous avez ${action} ${adder}`;
    req.session.alertType = 'danger';
    res.redirect(`/addfriend`);
  })
  .catch(err => { console.log(err); res.redirect('/error');});
});

// Get dialogue
app.get('/dialogue/:chatting', async (req, res) => {
  if (!req.session.user){ return res.redirect('/login'); }
  const user = req.session.user;
  const chatting = req.params.chatting;
  const friends = res.locals.friends;
  const friendsAsk = res.locals.friendsAsk;
  const chats = res.locals.chats;
  // Mettre à jour la session chatting
  req.session.chatting = chatting;
  res.locals.chatting = chatting;
  try {
    // Traitement des messages
    const messages = await Message.find({
      $or: [{ expediteur: user.pseudo }, { destinataire: user.pseudo }]
    });
    const heure = moment().format('h:mm:ss');
    const messagesFilter = messages.filter( message => 
      (message.expediteur === user.pseudo && message.destinataire === chatting) ||
      (message.destinataire === user.pseudo && message.expediteur === chatting)
    );
    res.render('Dialogue', {
      messagesFilter: messagesFilter, heure: heure, 
      user: user, chatting, friends, friendsAsk, chats,
    });
  } 
  catch (err) { console.log(err); res.redirect('/error');}
});

// Put message
app.put('/edit-message/:id', (req, res) => {
  const heure = moment().format('h:mm:ss');
  const messageData = {
    destinataire: req.body.destinataire,
    message: req.body.message,
    datetime: heure
  };
  Message.findByIdAndUpdate(req.params.id, messageData)
  .then(() => { res.redirect(`/dialogue/${req.body.destinataire}`); })
  .catch(err => { console.log(err); });
});

// Delete message
app.delete('/delete-message/:messageId', (req, res) => {
  const messageId = req.params.messageId;
  Message.findById(messageId)
  .then(message => {
    const user = req.session.user;
    const destinataire = message.destinataire;
    const expediteur = message.expediteur;
    let redirection = "";
    if (destinataire === user.pseudo){ redirection = expediteur;}
    else { redirection = destinataire;};
    Message.findByIdAndRemove(messageId)
    .then(() => {res.redirect(`/dialogue/${redirection}`);})
    .catch(err => { console.log(err); res.redirect('/'); });
  })
  .catch(error => { console.error('Erreur destinataire :', error); });
});

const PORT = 5001;
server.listen(PORT, () => {
  console.log(`Serveur écoutant sur le port ${PORT}`);
});