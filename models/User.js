// Mongodb et Mongoose :
const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
    pseudo: { type: 'String', requier : true, unique: true },
    email: { type: 'String', requier : true, unique: true },
    password: { type: 'String', requier : true },
    status: { type: 'String', requier : false },
    role: { type: 'String', requier : true }
});
module.exports = mongoose.model('User', userSchema);
