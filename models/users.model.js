const mongoose = require('mongoose');
const { Types } = require('mongoose');

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
  },
  active: {
    type: Boolean
  },
  peerId: {
    type: String
  },
  socket: {
    type: Types.ObjectId,
    ref: 'Socket'
  },
  interests: {
    type: [String],
    required: true
  }
});

const User = mongoose.model('User', userSchema);

module.exports = { userSchema, User };
