// jshint esversion:9
const mongoose = require('mongoose');
const { Types, Schema } = mongoose;

const followingSchema = new Schema({
  following_id: {
    type: String,
    required: true
  },
  followed_user: {
    type: Types.ObjectId,
    required: true,
    ref: 'User'
  },
  followed_by: {
    type: Types.ObjectId,
    required: true,
    ref: 'User'
  },
  timestamp: {
    type: Number,
    default: Date.now
  }
});

const Following = mongoose.model('Following', followingSchema);

module.exports = { Following };
