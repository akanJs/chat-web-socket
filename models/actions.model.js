// jshint esversion:9
const mongoose = require('mongoose');
const { Types } = mongoose;

const likeSchema = new mongoose.Schema({
  like_id: {
    type: String,
    required: true
  },
  post_id: {
    type: Types.ObjectId,
    required: true,
    ref: 'Post'
  },
  liked_by: {
    type: Types.ObjectId,
    required: true,
    ref: 'User'
  },
  timestamp: {
    type: Number,
    default: Date.now
  }
});

const commentSchema = new mongoose.Schema({
  comment_id: {
    type: String,
    required: true
  },
  post_id: {
    type: Types.ObjectId,
    required: true,
    ref: 'Post'
  },
  comment_text: {
    type: String,
    required: true,
    max: 400
  },
  commented_by: {
    type: Types.ObjectId,
    required: true,
    ref: 'User'
  },
  timestamp: {
    type: Number,
    default: Date.now
  }
});

const Like = mongoose.model('Like', likeSchema);
const Comment = mongoose.model('comment', commentSchema);

module.exports = { Like, Comment };
