
// jshint esversion: 9
const mongoose = require('mongoose');
const { Types, Schema } = mongoose;

const promotionSchema = new Schema({
  promotion_id: {
    type: String,
    required: true,
    max: 40
  },
  goal: {
    type: Types.ObjectId,
    required: true,
    ref: 'Goal'
  },
  audience: {
    type: Types.ObjectId,
    required: true,
    ref: 'Audience'
  },
  budget: {
    type: Types.ObjectId,
    required: true,
    ref: 'Budget'
  },
  post: {
    type: Types.ObjectId,
    required: true,
    ref: 'Post'
  },
  user: {
    type: Types.ObjectId,
    required: true,
    ref: 'User'
  },
  start_date: {
    type: Date,
    required: true
  },
  end_date: {
    type: Date,
    required: true
  },
  timestamp: {
    type: Number,
    required: true
  },
  expired: {
    type: Boolean,
    expired: false
  }
});

const Promotion = mongoose.model('Promotion', promotionSchema);

module.exports = { Promotion };
