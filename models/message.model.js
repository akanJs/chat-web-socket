// jshint esversion:8
const mongoose = require('mongoose');
const { Types } = require('mongoose');

const messageSchema = new mongoose.Schema({
  message_id: {
    type: String,
    required: true,
  },
  message_text: {
    type: String,
    required: true
  },
  from_id: {
    type: Types.ObjectId,
    ref: 'User',
    required: true
  },
  to_id: {
    type: Types.ObjectId,
    ref: 'User',
    required: true
  },
  room_id: {
    type: Types.ObjectId,
    ref: 'PrivateRoom',
    required: true
  },
  edited: {
    type: Boolean,
    default: false
  },
  liked: {
    type: Boolean,
    default: false
  },
  replied: {
    type: Boolean,
    default: false
  },
  parent_id: {
    type: Types.ObjectId,
    ref: 'Message',
    required: false
  },
  sent_date: {
    type: Date,
    default: new Date()
  }
});

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
const Message = mongoose.model('Message', messageSchema);

module.exports = { groupMessageSchema, GroupMessage, Message };
