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

const multer = require("multer");
const cookieParser = require('cookie-parser');

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
app.use('/uploads', express.static('uploads'));
io.use(sharedSession(sessionMiddleware, { autoSave: true }));


// Configuration de Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const user = req.session.user; 
      const extension = file.mimetype.split('/')[1]; 
      const fileName = `logo${user.pseudo}.${extension}`;
      cb(null, fileName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 5 // Limite à 5MB
  }
});

app.use(cookieParser());

// Créer un dossier 'uploads' si nécessaire
const fs = require('fs');
const path = require('path');
const { log } = require('console');
const uploadDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
io.on('connection', (socket) => {
  const user = socket.handshake.session.user;
  const chattingWith = socket.handshake.session.chatting?.pseudo;
  if (user && user.pseudo && chattingWith) {
    console.log(`${user.pseudo} a ouvert le chat pour : ${chattingWith}`);
    const room1 = `${user.pseudo.toLowerCase()}-${chattingWith.toLowerCase()}`;
    const room2 = `${chattingWith.toLowerCase()}-${user.pseudo.toLowerCase()}`;
    socket.join(room1);
    socket.join(room2);
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
        const expediteurData = await User.findOne({ pseudo: newMessage.expediteur });
        console.log('expediteurData.pseudo : ', expediteurData.pseudo);
        const destinataireData =  await User.findOne({ pseudo: newMessage.destinataire });
        console.log('destinataireData.pseudo : ', destinataireData.pseudo);
        io.to(`${newMessage.expediteur}-${newMessage.destinataire}`)
          .to(`${newMessage.destinataire}-${newMessage.expediteur}`)
          .emit('receiveText', {
            id: savedMessage._id,
            pseudo: expediteurData.pseudo,
            text,
            destinataire: destinataireData.pseudo,
            datetime: heure,
            expediteurPhoto: expediteurData.photo,
            destinatairePhoto: destinataireData.photo
          });
      } catch (err) {
        console.log(err);
        console.error("Erreur message ou de MAJ friend:", err);
      }
    });
    socket.on('disconnect', () => {
      console.log(`${user.pseudo} : logout`);
    });
  } else {
    console.error('User or chattingWith is undefined or does not have a pseudo');
  }
});

// Session  chatting
app.use((req, res, next) => {
  if (req.params && req.params.chatting) {
    req.session.chatting = req.params.chatting;
  }
  res.locals.chatting = req.session.chatting;
  next();
});

// Message d'alert
app.use((req, res, next) => {
  res.locals.alert = req.session.alert;
  res.locals.alertType = req.session.alertType;
  delete req.session.alert;
  delete req.session.alertType;
  next();
});
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
      const confirmedFriends = allFriends.filter(friend => { 
        return friend.confirm === true &&
              (friend.adder === user.pseudo || friend.asked === user.pseudo);
      });
      // Filtrer utilisateur qui chattent avec user.pseudo
      const chattingFriends = confirmedFriends.filter(friend => friend.chat && friend.chat.includes(user.pseudo));
      // Garde "adder/asker" different de user.pseudo => crée liste amis
      const friendsPseudos = confirmedFriends.map(friend => friend.adder === user.pseudo ? friend.asked : friend.adder);
      // Garde "adder/asker" different de user.pseudo => crée liste amis
      const chatsPseudos = chattingFriends.map(friend => friend.adder === user.pseudo ? friend.asked : friend.adder);
      // Filtre demandes reçues
      const friendsReceivedPseudos = allFriends
        .filter(friend => friend.confirm === false && friend.asked === user.pseudo)
        .map(friend => friend.adder);
      // Filtre demandes envoyées
      const friendsSendPseudos = allFriends
        .filter(friend => friend.confirm === false && friend.adder === user.pseudo)
        .map(friend => friend.asked);
      // Récupérer les objets utilisateur complets pour chaque liste
      friends = await User.find({ pseudo: { $in: friendsPseudos } });
      chats = await User.find({ pseudo: { $in: chatsPseudos } });
      friendsReceived = await User.find({ pseudo: { $in: friendsReceivedPseudos } });
      friendsSend = await User.find({ pseudo: { $in: friendsSendPseudos } });
      // Filtrer les utilisateurs disponibles par pseudo
      userPublicList = userPublicList.filter(data => data.status === true);
      userPublicList = userPublicList.filter(data => !friendsPseudos.includes(data.pseudo));
      userPublicList = userPublicList.filter(data => !friendsReceivedPseudos.includes(data.pseudo));
      userPublicList = userPublicList.filter(data => !friendsSendPseudos.includes(data.pseudo));
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
    console.error("Erreur => makeAvailable :", err);
    res.render("error", { message: "Erreur => makeAvailable" });
  }
};
app.use(makeAvailable);

//---------------------------------------ROOTS---------------------------------------//

// Index
app.get('/', (req, res) => {
  if (!req.session.user) {return res.redirect('/login'); }
  const user = req.session.user;
  const alert = req.params.alert;
  const heure = moment().format('DD-MM-YYYY, h:mm:ss');
  res.render('Home', { user, heure, alert});
});

// error
app.get('/error', (req, res) => {
  if (!req.session.user) {return res.redirect('/login'); }
  const user = req.session.user;
  res.render('Error', { user });
});

// Upload photo
app.post('/upload', upload.single('photo'), (req, res) => {
  if (!req.session.user) {return res.redirect('/login'); }
  const user = req.session.user;
  const fileName = req.file.filename; 
  User.findOneAndUpdate(
    { _id: user._id },   // Cibler user
    { photo: fileName }, // Mettre à jour photo
    { new: true }        // Retourner le document mis à jour
  )
  .then((updatedUser) => {
    req.session.user = updatedUser;
    res.redirect('/userpage');
  })
  .catch((err) => {
    console.error('Erreur de mise à jour:', err);
    res.redirect('/Error');
  });
});

// Edit datas
app.post('/updateData', async (req, res) => {
  if (!req.session.user) {return res.redirect('/login');}
  const userId = req.session.user._id;
  const { pseudo, email, password, checkPassword } = req.body;
  try {
    const user = await User.findById(userId);
    if (!bcrypt.compareSync(checkPassword, user.password)) {
      req.session.alert = `Mot de passe invalide `;
      req.session.alertType = 'danger';
      return res.redirect(`/account/${user.pseudo}`);
    }
    let message = '';
    if (pseudo) {
      user.pseudo = pseudo;
      message = `Mise à jour du pseudo réussie`;
    }
    if (email) {
      user.email = email;
      message = `Mise à jour de l'email réussie`;
    }
    if (password) {
      user.password = bcrypt.hashSync(password, 10);
      message = `Mise à jour du mot de passe réussie`;
    }
    await user.save();
    req.session.user = user;
    if (message) {
      req.session.alert = message;
      req.session.alertType = 'success';
    }
    res.redirect(`/account/${user.pseudo}`);
  } catch (error) {
    console.error(error);
    req.session.alert = `Mise à jour échouée`;
    req.session.alertType = 'danger';
    res.redirect(`/account/${user.pseudo}`);
  }
});


app.get('/account/:pseudo', (req, res) => {
  if (!req.session.user) {return res.redirect('/login');}
  const user = req.session.user;
  const logoPhoto = user && user.photo ? user.photo : 'logo.jpg';
  res.render('Account', { user, logoPhoto });
});

// Get register
app.get('/register', (req, res) => {
  const user = req.session.user;
  res.render('RegisterForm', { user: user });
});

// Post register
app.post('/register', (req, res) =>{
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
  const messagesFilter = res.locals.messagesFilter;
  res.render('LoginForm', { user: user, messagesFilter });
});

// Post login
app.post('/login', (req, res) => {
  User.findOne({ pseudo: req.body.pseudo }).then(user => {
    if (!user) { res.send('Pseudo invalide'); }
    if (!bcrypt.compareSync(req.body.password, user.password)){
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
app.get('/userpage', async (req, res) => {
  if (!req.session.user) { return res.redirect('/login');}
  const user = req.session.user;
  const friends = res.locals.friends;
  const friendsReceived = res.locals.friendsReceived;
  const friendsSend = res.locals.friendsSend;
  const chats = res.locals.chats; 
  const logoPhoto = user.photo ? user.photo : 'logo.jpg';
  const chatting = res.locals.chatting;
  const messagesFilter = res.locals.messagesFilter;
  res.render('Userpage', {
    user: res.locals.user,
    contacts: res.locals.contacts,
    userPublicList: res.locals.userPublicList,
    chatting, user, friends, friendsReceived, friendsSend, 
    chats,logoPhoto, messagesFilter
  });
});


// POST NEW MESSAGE
app.post('/message', (req, res) => {
  if (!req.session.user) {return res.redirect('/login');}
  const user = req.session.user;
  const heure = moment().format(' h:mm:ss');
  const messageData = new Message({
    expediteur: user.pseudo,
    destinataire: req.body.destinataire,
    message: req.body.message,
    datetime: heure
  });
  messageData.save()
    .then(() => res.redirect(`/userpage/${req.body.destinataire}`))
    .catch(err => {
      console.log(err);
    });
});

// Create new chat
app.post('/chat', async (req, res) => {
  try {
    const user = req.session.user;
    const destinataire = req.body.destinataire;
    const friend = await Friend.findOne({
      $or: [
        { adder: user.pseudo, asked: destinataire },
        { adder: destinataire, asked: user.pseudo }
      ]
    });
    if (!friend.chat) { friend.chat = []; }
    if (!friend.chat.includes(user.pseudo) && friend.chat.length < 2) {
      friend.chat.push(user.pseudo);
    }
    await friend.save();
    res.redirect(`/dialogue/${destinataire}`);
  } 
  catch (err) { console.log(err); res.redirect('/error');}
});

// Archiver discussion 
app.post('/archive', async (req, res) => {
  try {
    const user = req.session.user;
    const destinataire = req.body.destinataire;
    console.log(`${user.pseudo} a archivé son chat avec : ${destinataire}`);
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
  catch (err) { console.log(err); res.redirect('/error');}
});

// Get addfriend
app.get('/addfriend', async (req, res) => {
  if (!req.session.user) { return res.redirect('/login'); }
  const user = req.session.user;
  const status = user.status;
  const logoPhoto = user.photo ? user.photo : 'logo.jpg';
  const chatting = res.locals.chatting;
  let state, color;
  // Déterminer l'état en fonction du statut
  if (status === true) {state = "visible";color = "text-success";} 
  else {state = "invisible"; color = "text-danger";}
  res.render('AddFriend', {
    user, status, state, color, logoPhoto, chatting,
    userPublicList: res.locals.userPublicList,
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
    { new: true }      // Retourner le document
  )
  .then((updatedUser) => {
    console.log("Le statut de ", user.pseudo, ' devient: ',state);
    // Mettre à jour la session user
    req.session.user = updatedUser;
    res.redirect('/addfriend');
  })
  .catch((err) => {
    console.error('Erreur de mise à jour:', err);
    res.redirect('/error');
  });
});

// Post cancelrequest
app.post('/cancelrequest', (req, res) => {
  const adder = req.body.adder;
  const asked = req.body.asked;
  if (adder && asked) {
    Friend.findOneAndRemove({
      $or: [ { adder, asked }, { adder: asked, asked: adder } ]
    })
    .then(() => {
      req.session.alert = `Anulation demande faite à : ${asked}`;
      req.session.alertType = 'primary';
      res.redirect(`/addfriend`);
    })
    .catch(err => { console.log(err); res.redirect('/error');});
  }
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
      req.session.alert = `Demande d'ami envoyée à ${asked}`;
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
    req.session.alert = `Vous avez accepté : ${adder}`;
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
    $or: [ { adder, asked },  { adder: asked, asked: adder } ]
  })
  .then(() => {
    req.session.alert = `Vous avez ${action} ${adder}`;
    req.session.alertType = 'danger';
    res.redirect(`/addfriend`);
  })
  .catch(err => { console.log(err); res.redirect('/error');});
});

// Search 1 
app.post('/search', async (req, res) => {
  if (!req.session.user){ return res.redirect('/login');}
  const user = req.session.user;
  const search = req.body.search;
  const chatting = res.locals.chatting;
  const heure = moment().format('h:mm:ss');
  try {
    let messagesFilter = [];
    if (search) {
      const messages = await Message.find({
        $or: [{ expediteur: user.pseudo },{ destinataire: user.pseudo }]
      });
      messagesFilter = messages.filter(message => 
        (message.expediteur === user.pseudo && message.destinataire === chatting.pseudo) ||
        (message.destinataire === user.pseudo && message.expediteur === chatting.pseudo)
      );
      messagesFilter = messages.filter(message =>
        message.message.toLowerCase().includes(search.toLowerCase())
      );
    }
    res.render('Search', { user, search, messagesFilter, heure, chatting });
  } 
  catch (err) { console.error(err); res.redirect('/error');}
});

// Get dialogue and handle search
app.get('/dialogue/:chatting', async (req, res) => {
  if (!req.session.user) { return res.redirect('/login');}
  const user = req.session.user;
  const chattingPseudo = req.params.chatting;
  const friends = res.locals.friends;
  const friendsAsk = res.locals.friendsAsk;
  const chats = res.locals.chats;
  const search = req.query.search;
  try {
    const chattingUser = await User.findOne({ pseudo: chattingPseudo });
    req.session.chatting = chattingUser;
    res.locals.chatting = chattingUser;
    const messages = await Message.find({
      $or: [{ expediteur: user.pseudo }, { destinataire: user.pseudo }]
    });
    const heure = moment().format('h:mm:ss');
    let messagesFilter = messages.filter(message =>
      (message.expediteur === user.pseudo && message.destinataire === chattingPseudo) ||
      (message.destinataire === user.pseudo && message.expediteur === chattingPseudo)
    );
    let messagesFilterSearcher = [];
    if (search) {
        messagesFilterSearcher = messagesFilter.filter(message =>
        message.message.toLowerCase().includes(search.toLowerCase())
      );
      console.log('search: ', search);
    }
    res.render('Dialogue', {
      messagesFilter, messagesFilterSearcher, heure, chats,
      user, chatting: chattingUser, friends, friendsAsk, showModal: !!search,
    });
  } 
  catch (err) {console.log(err); res.redirect('/error');}
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

// cmd windows-> tape : ipconfig -> ipv4 : 192.168.1.237
// for phone :  192.168.1.187:5000
const PORT = 5001;
server.listen(PORT, () => {
  console.log(`Serveur écoutant sur le port ${PORT}`);
});