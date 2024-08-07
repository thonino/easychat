// Mongodb et Mongoose :
const mongoose = require('mongoose');
const friendSchema = new mongoose.Schema({
  adder: { type: String },
  asked: { type: String },
  confirm: { type: Boolean, default: false},
  chat: { type: Array},
});

module.exports = mongoose.model('Friend', friendSchema);