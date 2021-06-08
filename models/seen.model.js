// jshint esversion:9
const mongoose = require('mongoose');
const { Types } = mongoose;

const seenSchema = new mongoose.Schema({
  seen_id: {
    type: String,
    required: true
  },
  post_id: {
    type: Types.ObjectId,
    ref: 'Post',
    required: true
  },
  seen_by: {
    type: Types.ObjectId,
    ref: 'User',
    required: true
  },
  timestamp: {
    type: Number,
    default: Date.now
  }
});

const Seen = mongoose.model('Seen', seenSchema);

module.exports = { Seen };
