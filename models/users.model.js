const mongoose = require('mongoose');
const uuid = require('uuid');

const userSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  user_img: {
    type: String,
    required: true
  },
  first_name: {
    type: String,
    required: true
  },
  last_name: {
    type: String,
    required: true
  },
  user_full_name: {
    type: String,
    required: true
  }
});

const User = mongoose.model('User', userSchema);

module.exports = { userSchema, User };
