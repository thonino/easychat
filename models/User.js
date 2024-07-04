// Mongodb et Mongoose :
const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
    pseudo: { type: String, unique: true },
    email: { type: String, unique: true },
    password: { type: String},
    status: { type: Boolean, default: false},
    role: { type: String}
});
module.exports = mongoose.model('User', userSchema);