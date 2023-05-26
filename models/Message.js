// Mongodb et Mongoose :
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  expediteur: { type: 'String'},
  destinataire: { type: 'String', },
  message: { type: 'String',required: true },
  datetime: { type: 'String' }
});

module.exports = mongoose.model('Message', messageSchema);