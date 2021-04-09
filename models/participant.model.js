// jshint esversion:8
const mongoose = require('mongoose');
const { Types } = require('mongoose');

const participantSchema = new mongoose.Schema({
  participant_id: {
    type: String,
    required: true
  },
  participant: {
    type: Types.ObjectId,
    ref: 'User',
    required: true
  },
  group_id: {
    type: Types.ObjectId,
    ref: 'Group',
    required: true
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  joined_date: {
    type: String,
    required: true
  }
});

const Participant = mongoose.model('Participant', participantSchema);

module.exports = { participantSchema, Participant };
