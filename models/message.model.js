// jshint esversion:8
const mongoose = require('mongoose');
const { Types } = require('mongoose');

const groupMessageSchema = new mongoose.Schema({
  group: {
    type: Types.ObjectId,
    ref: 'Group'
  },
  message_text: {
    type: String,
    required: true
  },
  sent_by: {
    type: Types.ObjectId,
    ref: 'Participant',
    required: true
  },
  sent_date: {
    type: String,
    required: true
  }
});

const GroupMessage = mongoose.model('GroupMessage', groupMessageSchema);

module.exports = { groupMessageSchema, GroupMessage };
