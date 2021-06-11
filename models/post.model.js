// jshint esversion:9
const mongoose = require('mongoose');
const { Types } = mongoose;

const postSchema = new mongoose.Schema({
  post_id: {
    type: String,
    required: true
  },
  post_type: {
    type: String,
    required: true
  },
  post_description: {
    type: String,
    required: false,
    max: 400
  },
  post_url: {
    type: String,
    required: true
  },
  timestamp: {
    type: Number,
    default: Date.now
  },
  posted_date: {
    type: Date,
    default: new Date()
  },
  posted_by: {
    type: Types.ObjectId,
    ref: 'User',
    required: true
  },
  seen: {
    type: Boolean,
    default: false
  },
  tags: {
    type: [String],
    required: true
  },
  promoted: {
    type: Boolean,
    default: false
  }
});

const Post = mongoose.model('Post', postSchema);

module.exports = { Post };
