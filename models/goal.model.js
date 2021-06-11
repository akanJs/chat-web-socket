// jshint esversion: 9
const mongoose = require('mongoose');
const { Schema } = mongoose;

const goalSchema = new Schema({
  goal_id: {
    type: String,
    required: true,
    max:40
  },
  goal_type: {
    type: String,
    required: true,
    max: 50
  },
  url: {
    type: String,
    required: true,
    max: 500
  }
});

const Goal = mongoose.model('Goal', goalSchema);

module.exports = { Goal };