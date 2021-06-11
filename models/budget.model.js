// jshint esversion: 9
const mongoose = require('mongoose');
const { Schema } = mongoose;

const budgetSchema = new Schema({
  budget_id: {
    type: String,
    required: true,
    max: 40
  },
  amount: {
    type: Number,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  total_amount : {
    type: Number,
    required: true
  },
  duration_type: {
    type: String,
    required: true,
    max: 6
  }
});

const Budget = mongoose.model('Budget', budgetSchema);

module.exports = { Budget };