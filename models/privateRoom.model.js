const mongoose = require('mongoose');
const { Types } = require('mongoose');

const privateRoomSchema = new mongoose.Schema({
  room_id: {
    type: String,
    required: true
  },
  user_id: {
    type: Types.ObjectId,
    ref: 'User',
    required: true
  },
  with_user_id: {
    type: Types.ObjectId,
    ref: 'User',
    required: true
  }
});

const PrivateRoom = mongoose.model('PrivateRoom', privateRoomSchema);

module.exports = { privateRoomSchema, PrivateRoom };
