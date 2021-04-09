// jshint esversion:8
const mongoose = require('mongoose');
const { Types } = require('mongoose');

const groupMessageSchema = new mongoose.Schema({
  group_id: {
    type: Types.ObjectId,
    ref: 'Group'
  },
  message_text: {
    type: String,
    required: true
  },
  sentBy: {
    type: Types.ObjectId,
    ref: 'Participant',
    required: true
  },
  sentDate: {
    type: String,
    required: true
  }
});

const GroupMessage = mongoose.model('GroupMessage', groupMessageSchema);

module.exports = { groupMessageSchema, GroupMessage };
