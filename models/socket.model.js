const mongoose = require('mongoose');
const { Types } = require('mongoose');
const socketSchema = new mongoose.Schema({
  socket: {
    type: String,
    required: true
  },
  user_id: {
    type: Types.ObjectId,
    ref: 'User'
  }
});
const Socket = mongoose.model('Socket', socketSchema);

module.exports = { socketSchema, Socket };
