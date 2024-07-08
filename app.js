// express & express-session
const express = require('express');
const session = require('express-session');
const app = express();
const http = require('http');
const socketIo = require('socket.io');
const sharedSession = require('express-socket.io-session');
const server = http.createServer(app);
const io = socketIo(server);

// bcrypt
const bcrypt = require('bcrypt');

// MongoDB Mongoose et dotenv
require('dotenv').config();
const mongoose = require('mongoose');
const Message = require('./models/Message');
const User = require('./models/User');
const Friend = require('./models/Friend');
const { log } = require('console');
const url = process.env.DATABASE_URL;
mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => { console.log("MongoDB connected"); })
  .catch(err => { console.log(err); });

// EJS :
app.set('view engine', 'ejs');

// BodyParser
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));

const sessionMiddleware = session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
});
app.use(sessionMiddleware);

// Method-override :
const methodOverride = require('method-override');
app.use(methodOverride('_method'));

// get datetime
const moment = require('moment');

app.use('/public', express.static('public'));

// Partager la session entre Express et Socket.IO
io.use(sharedSession(sessionMiddleware, {
  autoSave: true
}));

// SESSION CHATTING
app.use((req, res, next) => {
  if (req.params && req.params.chatting) {
    req.session.chatting = req.params.chatting;
  }
  res.locals.chatting = req.session.chatting;
  next();
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
    let friendsReceived = [];
    let friendsSend = [];

    if (user) {
      userPublicList = await User.find();
      const allFriends = await Friend.find();

      // Filter and push for confirmed friends
      friends = allFriends.filter(friend => {
        return friend.confirm === true &&
              (friend.adder === user.pseudo || friend.asked === user.pseudo);
      }).map(friend => friend.adder === user.pseudo ? friend.asked : friend.adder);

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

    next();
  } catch (err) {
    console.error("Erreur lors de la récupération des thèmes et de l'utilisateur :", err);
    res.render("error", { message: "Erreur lors de la récupération des thèmes et de l'utilisateur" });
  }
};

app.use(makeAvailable);


//---------------------------------ROOTS---------------------------------//


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
  // Friends
  const friends= res.locals.friends;
  const friendsRecieved= res.locals.friendsRecieved;
  const friendsSend= res.locals.friendsSend;
  res.render('userpage', {
    user: res.locals.user,
    contacts: res.locals.contacts,
    userPublicList: res.locals.userPublicList,
    chatting: res.locals.chatting,
    friends, friendsRecieved, friendsSend
  });
});

// ADD FRIEND PAGE
app.get('/addfriend', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.render('AddFriend', {
    user: res.locals.user,
    userPublicList: res.locals.userPublicList,
    chatting: res.locals.chatting,
    friends: res.locals.friends,
    friendsAsk: res.locals.friendsAsk,
  });
});

// SEND FRIEND REQUEST
app.post('/sendrequest', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
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
  if (!req.session.user) {
    return res.redirect('/login');
  }
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
  if (!req.session.user) {
    return res.redirect('/login');
  }
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

  // Update session chatting 
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

// Socket.IO: Écouter connexions 
io.on('connection', (socket) => {
  const user = socket.handshake.session.user;
  if (user) {
    console.log(user.pseudo + ' est connecté');
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
        .then((savedMessage) => {  // Accéder au message 
        
          console.log(`Send : ${text} from ${user.pseudo} to ${destinataire}`);  // Log pour debug
          io.emit('receiveText', { 
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
      console.log('Un utilisateur s\'est déconnecté');
    });
  }
});


const PORT = 5001;
server.listen(PORT, () => {
  console.log(`Serveur écoutant sur le port ${PORT}`);
});
