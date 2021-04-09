// jshint esversion:8
const mongoose = require('mongoose');
const { Types } = require('mongoose');

const groupSchema = new mongoose.Schema({
  group_id: {
    type: String,
    required: true
  },
  group_name: {
    type: String,
    required: true,
    maxLength: 20
  },
  group_icon: {
    type: String,
    default: ''
  },
  group_description: {
    type: String,
    maxLength: 100
  },
  created_by: {
    type: Types.ObjectId,
    ref: 'User',
    required: true
  },
  created_date: {
    type: String,
    required: true
  }
});

const Group = mongoose.model('Group', groupSchema);

module.exports = { groupSchema, Group };
