// jshint esversion: 9
const mongoose = require('mongoose');
const { Types, Schema } = mongoose;

const audienceSchema = new Schema({
  audience_id: {
    type: String,
    required: true,
    max: 40
  },
  user: {
    type: Types.ObjectId,
    required: true,
    ref: 'User'
  },
  name: {
    type: String,
    required: true,
    max: 50,
    min: 4
  },
  country: {
    type: String,
    required: true,
    max: 100,
    min: 4
  },
  interests: {
    type: [String],
    required: true
  },
  gender: {
    type: String,
    default: 'all'
  }
});

const Audience = mongoose.model('Audience', audienceSchema);

module.exports = { Audience };
