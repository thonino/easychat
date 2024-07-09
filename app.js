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

mongoose.connect(process.env.DATABASE_URL, { useNewUrlParser: true, useUnifiedTopology: true })
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
    console.log(`${user.pseudo} in message-box with ${chattingWith}`);
    socket.join(`${user.pseudo}-${chattingWith}`);
    socket.join(`${chattingWith}-${user.pseudo}`);

    // Écouter messages
    socket.on('sendText', ({ text, destinataire }) => {
      const heure = moment().format('h:mm:ss');
      const newMessage = new Message({
        expediteur: user.pseudo,
        destinataire: destinataire,
        message: text,
        datetime: heure
      });

      newMessage.save()
        .then((savedMessage) => {
          console.log(`Send : ${text} from ${user.pseudo} to ${destinataire}`);  // Log pour debug
          io.to(`${user.pseudo}-${destinataire}`).to(`${destinataire}-${user.pseudo}`).emit('receiveText', {
            id: savedMessage._id,
            pseudo: user.pseudo,
            text: text,
            destinataire: destinataire,
            datetime: heure
          });
        })
        .catch(err => console.log(err));
    });

    socket.on('disconnect', () => {
      console.log(`${user.pseudo} : logout`);
    });
  }
});

// Confirm message
app.use((req, res, next) => {
  res.locals.confirm = req.session.confirm;
  res.locals.alertType = req.session.alertType;
  delete req.session.confirm;
  delete req.session.alertType;
  next();
});

// Make available for all
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

      // Filter and push for confirmed friends
      friends = allFriends.filter(friend => {
        return friend.confirm === true &&
              (friend.adder === user.pseudo || friend.asked === user.pseudo);
      });

      // Filter user who is chatting
      chats = friends.filter(friend => friend.chat && friend.chat.includes(user.pseudo));

      // Map the friends to get only the pseudo values
      friends = friends.map(friend => friend.adder === user.pseudo ? friend.asked : friend.adder);

      // Map the chats to get only the pseudo values
      chats = chats.map(friend => friend.adder === user.pseudo ? friend.asked : friend.adder);

      // Filter demandes reçues
      friendsReceived = allFriends
        .filter(friend => friend.confirm === false && friend.asked === user.pseudo)
        .map(friend => friend.adder);

      // Filter demandes envoyées
      friendsSend = allFriends
        .filter(friend => friend.confirm === false && friend.adder === user.pseudo)
        .map(friend => friend.asked);

      // Trier les utilisateurs disponibles par pseudo
      userPublicList = userPublicList.sort((a, b) => a.pseudo.localeCompare(b.pseudo));
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
    console.error("Erreur lors de la récupération des thèmes et de l'utilisateur :", err);
    res.render("error", { message: "Erreur lors de la récupération des thèmes et de l'utilisateur" });
  }
};

app.use(makeAvailable);


//---------------------------------------ROOTS---------------------------------------//

// GET HOME
app.get('/', (req, res) => {
  const user = req.session.user;
  const heure = moment().format('DD-MM-YYYY, h:mm:ss');
  res.render('home', { user: user, heure: heure, userPublic: res.locals.userPublic, });
});

// GET REGISTER
app.get('/register', (req, res) => {
  const user = req.session.user;
  res.render('RegisterForm', { user: user });
});

// POST REGISTER
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

// GET LOGIN
app.get('/login', (req, res) => {
  const user = req.session.user;
  res.render('LoginForm', { user: user });
});

// POST LOGIN
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

// GET LOGOUT
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) { console.log(err); }
    else { res.redirect('/login'); }
  });
});

// GET USER PAGE
app.get('/userpage', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  // Utilisation de la variable res.locals.chats
  const user = req.session.user;
  const friends = res.locals.friends;
  const friendsReceived = res.locals.friendsReceived;
  const friendsSend = res.locals.friendsSend;
  const chats = res.locals.chats; 

  console.log(chats); 

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

    // Trouver une relation d'amitié entre les deux utilisateurs
    const friend = await Friend.findOne({
      $or: [
        { adder: user.pseudo, asked: destinataire },
        { adder: destinataire, asked: user.pseudo }
      ]
    });

    // Si une relation existe, mettre à jour la propriété 'chat' du document
    if (friend) {
      if (!friend.chat.includes(user.pseudo)) {
        friend.chat.push(user.pseudo);
      }
      if (!friend.chat.includes(destinataire)) {
        friend.chat.push(destinataire);
      }
      await friend.save();
    } else {
      // Si aucune relation n'existe, créer une nouvelle relation d'amitié avec le chat initialisé
      await Friend.create({
        adder: user.pseudo,
        asked: destinataire,
        confirm: true, // Vous pouvez ajuster cette valeur selon vos besoins
        chat: [user.pseudo, destinataire]
      });
    }

    res.redirect(`/dialogue/${destinataire}`);
  } catch (err) {
    console.log(err);
    res.redirect('/error');
  }
});

// Archive
app.post('/archive', async (req, res) => {
  try {
    const user = req.session.user;
    const destinataire = req.body.destinataire;
    console.log(destinataire+"'s messages archived by "+user.pseudo);

    // Trouver une relation d'amitié entre les deux utilisateurs
    const friend = await Friend.findOne({
      $or: [
        { adder: user.pseudo, asked: destinataire },
        { adder: destinataire, asked: user.pseudo }
      ]
    });

    // Vérifier si la relation d'amitié existe
    if (!friend) { return res.status(404).send('Friend 404'); }

    // Retirer l'utilisateur du tableau chat
    friend.chat = friend.chat.filter(data => data !== user.pseudo);

    // Sauvegarder les modifications
    await friend.save();

    res.redirect(`/dialogue/${destinataire}`);
  } catch (err) {
    console.log(err);
    res.redirect('/error');
  }
});


// ADD FRIEND PAGE
app.get('/addfriend', (req, res) => {
  if (!req.session.user){ return res.redirect('/login'); }
  res.render('AddFriend', {
    user: res.locals.user,
    userPublicList: res.locals.userPublicList,
    chatting: res.locals.chatting,
    friends: res.locals.friends,
    friendsAsk: res.locals.friendsAsk,
    chats: res.locals.chats,
  });
});

// SEND FRIEND REQUEST
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

// AGREE
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
    .catch(err => {
      console.log(err);
      res.redirect('/error');
    });
});

// DISAGREE DELETED
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
    .catch(err => {
      console.log(err);
      res.redirect('/error');
    });
});

// GET DIALOGUE
app.get('/dialogue/:chatting', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  const user = req.session.user;
  const chatting = req.params.chatting;
  const friends = res.locals.friends;
  const friendsAsk = res.locals.friendsAsk;
  const chats = res.locals.chats;

  // Mettre à jour la session chatting
  req.session.chatting = chatting;
  res.locals.chatting = chatting;

  Message.find({
    $or: [{ expediteur: user.pseudo }, { destinataire: user.pseudo }]
  }).then(messages => {
    const heure = moment().format('h:mm:ss');
    const messagesFilter = messages.filter(
      message => (message.expediteur === user.pseudo && message.destinataire === chatting) ||
        (message.destinataire === user.pseudo && message.expediteur === chatting)
    );
    res.render('Dialogue', {
      messagesFilter: messagesFilter,
      heure: heure,
      user: user,
      chatting,
      friends,
      friendsAsk,
      chats,
    });
  }).catch(err => {
    console.log(err);
  });
});

// GET NEW MESSAGE
app.get('/message/new', (req, res) => {
  if (!req.session.user) { return res.redirect('/login'); }
  const user = req.session.user;
  const heure = moment().format('h:mm:ss');
  res.render('messageForm', { user: user, heure: heure });
});

// POST NEW MESSAGE
app.post('/message', (req, res) => {
  if (!req.session.user) { return res.redirect('/login'); }
  const user = req.session.user;
  const heure = moment().format('h:mm:ss');
  const messageData = new Message({
    expediteur: user.pseudo,
    destinataire: req.body.destinataire,
    message: req.body.message,
    datetime: heure
  });
  messageData.save()
    .then(() => res.redirect(`/dialogue/${req.body.destinataire}`))
    .catch(err => {
      console.log(err);
    });
});

// GET EDIT PAGE
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

// DELETE MESSAGE
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
    .then(() => {
      res.redirect(`/dialogue/${redirection}`);
    })
    .catch(err => {
      console.log(err);
      // Ou rediriger 404
      res.redirect('/'); 
    });
  })
  .catch(error => {
    console.error('Erreur lors de la récupération du destinataire :', error);
  });
});

const PORT = 5001;
server.listen(PORT, () => {
  console.log(`Serveur écoutant sur le port ${PORT}`);
});