// Mongodb et Mongoose :
const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
    pseudo: { type: 'String', required: true, unique: true },
    email: { type: 'String', required: true, unique: true },
    password: { type: 'String', required: true },
    status: { type: 'String', required : false },
    role: { type: 'String', required: true }
});
module.exports = mongoose.model('User', userSchema);



