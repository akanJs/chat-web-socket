const mongoose = require('mongoose');
const { Types } = require('mongoose');

const channelSchema = new mongoose.Schema({
  channel_id: {
    type: String,
    required: true
  },
  group_id: {
    type: Types.ObjectId,
    ref: 'Group',
    required: true
  }
});

const Channel = mongoose.model('Channel', channelSchema);

module.exports = { channelSchema, Channel };
