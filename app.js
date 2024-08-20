// Importation des modules nécessaires
const express = require('express');
const session = require('express-session');
const http = require('http');
const https = require('https');
const socketIo = require('socket.io');
const sharedSession = require('express-socket.io-session');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const mongoose = require('mongoose');
const moment = require('moment');
const cookieParser = require('cookie-parser');
const multer = require('multer');
require('dotenv').config();

const bcrypt = require('bcrypt');
const crypto = require('crypto');

const nodemailer = require('nodemailer');
// Configurer le transporteur SMTP 
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS
  }
});

// Vérifier la configuration du transporteur
transporter.verify(function(error, success) {
  if (error) { console.log(error); } 
  else{ console.log('Mailer configuration succefull');}
});

// Importation des modèles
const Message = require('./models/Message');
const User = require('./models/User');
const Friend = require('./models/Friend');
const UploadFile = require('./models/UploadFile'); 

// Configuration de l'application Express
const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(methodOverride('_method'));
app.use(cookieParser());

// Configuration des fichiers statiques
app.use('/public', express.static('public'));

// Configuration de la session
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } 
});
app.use(sessionMiddleware);

// Configuration de Socket.io avec session partagée
const server = http.createServer(app);
const io = socketIo(server);
io.use(sharedSession(sessionMiddleware, { autoSave: true }));

// Connexion à MongoDB
const mongoURI = process.env.DATABASE_URL;
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("MongoDB connecté avec succès");
  })
  .catch(err => {
    console.error('Erreur de connexion à MongoDB:', err);
    process.exit(1);
  });

// Configuration de Multer pour l'upload d'image
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Session chatting
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


// Rendre disponible
const makeAvailable = async (req, res, next) => {
  try {
    const user = req.session.user;
    let userPublicList = [];
    let friends = [];
    let chats = [];
    let friendsReceived = [];
    let friendsSend = [];
    let logoPhoto = '/public/img/profilDefault.jpg'; 
    if (user) {
      // Récupération de la photo de profil de l'utilisateur connecté
      const profilFilename = `profil${user.pseudo}`;
      const file = await UploadFile.findOne({ filename: profilFilename });
      if (file) {
        logoPhoto = `/image/${file.filename}`;
      }
      // Récupération des données des amis et utilisateurs
      userPublicList = await User.find();
      const allFriends = await Friend.find();
      const confirmedFriends = allFriends.filter(friend => { 
        return friend.confirm === true &&
              (friend.adder === user.pseudo || friend.asked === user.pseudo);
      });
      const chattingFriends = confirmedFriends.filter(friend => friend.chat && friend.chat.includes(user.pseudo));
      const friendsPseudos = confirmedFriends.map(friend => friend.adder === user.pseudo ? friend.asked : friend.adder);
      const chatsPseudos = chattingFriends.map(friend => friend.adder === user.pseudo ? friend.asked : friend.adder);
      
      const friendsReceivedPseudos = allFriends
      .filter(friend => friend.confirm === false && friend.asked === user.pseudo)
      .map(friend => friend.adder);
    

      const friendsSendPseudos = allFriends
      .filter(friend => friend.confirm === false && friend.adder === user.pseudo)
      .map(friend => friend.asked);

      friends = await User.find({ pseudo: { $in: friendsPseudos } });
      chats = await User.find({ pseudo: { $in: chatsPseudos } });
      friendsReceived = await User.find({ pseudo: { $in: friendsReceivedPseudos } });
      friendsSend = await User.find({ pseudo: { $in: friendsSendPseudos } });

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
    res.locals.logoPhoto = logoPhoto;
    next();
  } catch (err) {
    console.error("Erreur => makeAvailable :", err);
    res.render("error", { message: "Erreur => makeAvailable" });
  }
};
app.use(makeAvailable);

//socket io
io.on('connection', (socket) => {
  const user = socket.handshake.session.user;
  const chattingWith = socket.handshake.session.chatting?.pseudo;
  if (user && user.pseudo && chattingWith) {
    console.log(`${user.pseudo} a ouvert le chat pour : ${chattingWith}`);
    const room1 = `${user.pseudo}-${chattingWith}`;
    const room2 = `${chattingWith}-${user.pseudo}`;
    socket.join(room1);
    socket.join(room2);
    socket.on('sendText', async ({ text }) => {
      const heure = moment().format('h:mm:ss');
      const newMessage = new Message({
        expediteur: user.pseudo,
        destinataire: chattingWith,
        message: text,
        datetime: heure
      });
      try {
        // when sending message Add user to contact  
        const friend = await Friend.findOne({
          $or: [
            { adder: user.pseudo, asked: chattingWith  },
            { adder: chattingWith , asked: user.pseudo }
          ]
        });
        const chatChecking = friend.chat;
        if (!chatChecking.includes(chattingWith)) {
          friend.chat = [chattingWith, user.pseudo];
          await friend.save();
        }
        // fin when
        const savedMessage = await newMessage.save();
        console.log(`Texte: ${newMessage.message}`);
        console.log(`De: ${newMessage.expediteur}`);
        console.log(`A: ${newMessage.destinataire}`);
        const expediteurData = await User.findOne({ pseudo: newMessage.expediteur });
        const destinataireData =  await User.findOne({ pseudo: newMessage.destinataire });
        io.to(`${newMessage.expediteur}-${newMessage.destinataire}`)
          .to(`${newMessage.destinataire}-${newMessage.expediteur}`)
          .emit('receiveText', {
            id: savedMessage._id,
            pseudo: expediteurData.pseudo,
            destinataire: destinataireData.pseudo,
            text, expediteurData, destinataireData,
            datetime: heure,
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

//------- Pour render, decommenter avant d'envoyer sur git -------//

function keepAlive() {
  setInterval(() => {
    https.get('https://easychat-tue1.onrender.com/health', (res) => { 
      res.on('data', () => {});
      res.on('end', () => console.log('test ping successful.'));
    }).on('error', (err) => {
      console.log('test ping failed: ' + err.message);
    });
  }, 873737); // Intervalle d'environ 14 minutes et 33 secondes
}

keepAlive();

// Endpoint de vérification 
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});


//---------------------------------------ROOTS---------------------------------------//

// Route pour uploader une photo
app.post('/upload', upload.single('photo'), async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  try {
    const filename = `profil${req.session.user.pseudo}`;
    // Met à jour le document si le filename existe, sinon crée un nouveau document
    await UploadFile.findOneAndUpdate({ filename },  
      { 
        contentType: req.file.mimetype,
        data: req.file.buffer
      },  
      { upsert: true, new: true }  // Crée le document si non trouvé 
    );
    res.redirect('/account/' + req.session.user.pseudo);
  } catch (err) {
    console.error('Erreur lors de l\'upload de l\'image:', err);
    res.status(500).json({ error: 'Échec de l\'upload de l\'image' });
  }
});

// Route pour servir l'image
app.get('/image/:filename', async (req, res) => {
  try {
    const file = await UploadFile.findOne({ filename: req.params.filename });
    if (!file) {
      return res.status(404).json({ error: 'Image non trouvée' });
    }
    res.set('Content-Type', file.contentType);
    res.send(file.data);
  } catch (err) {
    console.error('Erreur lors de la récupération de l\'image:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'image' });
  }
});

// Route Test pour avoyer des mail
// app.get('/sendmail', (req, res) => {
//   res.render('SendMail')
// })
// app.post('/sendmail', (req, res) => {
//   const { email, text, subject } = req.body;
//   const mailOptions = {
//     from: 'easychat.freeapp@gmail.com',
//     to: email,
//     subject: subject,
//     text: text
//   };
//   transporter.sendMail(mailOptions, (error, info) => {
//     if (error) { console.error(error);
//       return res.status(500).send("<h1>Error sending email</h1>");
//     }
//     res.send(`<h1>Un mail a été envoyé sur ${email}</h1>`);
//   });
// });

// Route pour afficher la page de compte utilisateur
app.get('/account/:pseudo', (req, res) => {
  if (!req.session.user) {
    console.log('Utilisateur non connecté, redirection vers login');
    return res.redirect('/login');
  }
  const user = res.locals.user;
  const logoPhoto = res.locals.logoPhoto;
  res.render('Account', { user, logoPhoto });
});

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

// Forgot password
app.get('/passwordforgot', (req, res) => {
  res.render('PasswordForgot');
});
app.post('/passwordforgot', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send("<h1>Email introuvable</h1>"); 
    }
    const token = crypto.randomBytes(20).toString('hex');
    user.token = token;
    user.tokenExpires = Date.now() + 3600000; // 1 hour
    await user.save();
    const mailOptions = {
      from: 'easychat.freeapp@gmail.com',
      to: email,
      subject: 'Reset password',
      text: `Reset your password at this address: https://easychat-tue1.onrender.com/reset/${token}`
      // text: `Reset your password at this address: http://localhost:5001/reset/${token}`
    };
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error(error);
        return res.status(500).send("<h1>Error sending email</h1>");
      }
      res.send(`<h1>Un mail vous a été envoyé sur ${email}</h1>`);
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("<h1>Echec de la Requête</h1>");
  }
});

// Reset password
app.get('/reset/:token', (req, res) => {
  const token = req.params.token;
  res.render('PasswordReset', { token });
});
app.post('/passwordreset', async (req, res) => {
  const { token, password } = req.body;
  try {
    const user = await User.findOne({
      token: token,
      tokenExpires: { $gt: Date.now() }
    });
    if (!user) {
      return res.status(400).send("<h1>Erreur ou token expiré</h1>");
    }
    user.password = bcrypt.hashSync(password, 10);
    user.token = undefined;
    user.tokenExpires = undefined;
    await user.save();
    
    res.send("<h1>Réinitialisation du mot de passe réussi</h1>");
  } catch (error) {
    console.error(error);
    res.status(500).send("<h1>Echec de la réinitialisation</h1>");
  }
});

// Get userpage
app.get('/userpage', async (req, res) => {
  if (!req.session.user) { return res.redirect('/login');}
  const user = req.session.user;
  const friends = res.locals.friends;
  const friendsReceived = res.locals.friendsReceived;
  const friendsSend = res.locals.friendsSend;
  const chats = res.locals.chats; 
  const chatting = res.locals.chatting;
  const messagesFilter = res.locals.messagesFilter;
  const logoPhoto = res.locals.logoPhoto;
  res.render('Userpage', {
    user: res.locals.user,
    contacts: res.locals.contacts,
    userPublicList: res.locals.userPublicList,
    chatting, user, friends, friendsReceived, friendsSend, 
    chats,logoPhoto, messagesFilter, logoPhoto,

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
    const friends = await Friend.findOne({
      $or: [
        { adder: user.pseudo, asked: destinataire },
        { adder: destinataire, asked: user.pseudo }
      ]
    });
    // Retirer user.pseudo du tableau
    friends.chat = friends.chat.filter(data => data !== user.pseudo);
    await friends.save(); 
    res.redirect(`/userpage`);
  } 
  catch (err) { console.log(err); res.redirect('/error');}
});

// Get addfriend
app.get('/addfriend', async (req, res) => {
  if (!req.session.user) { return res.redirect('/login'); }
  const user = req.session.user;
  const status = user.status;
  const logoPhoto = res.locals.logoPhoto;
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
    chats: res.locals.chats, logoPhoto,
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
  const logoPhoto = res.locals.logoPhoto;
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
        message.message.includes(search)
      );
    }
    res.render('Search', { user, search, messagesFilter, heure, chatting, logoPhoto });
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
  const logoPhoto = res.locals.logoPhoto;
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
        message.message.includes(search)
      );
      console.log('search: ', search);
    }
    res.render('Dialogue', {
      messagesFilter, messagesFilterSearcher, heure, chats, logoPhoto,
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