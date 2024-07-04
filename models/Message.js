// Mongodb et Mongoose :
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  expediteur: { type: String },
  destinataire: { type: String },
  message: { type: String},
  datetime: { type: String },
  saw: { type: Boolean, default: false }
});

module.exports = mongoose.model('Message', messageSchema);