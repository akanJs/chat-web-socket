const mongoose = require('mongoose');
const { Types } = mongoose;

const requestSchema = new mongoose.Schema({
  group: {
    type: Types.ObjectId,
    ref: 'Group',
    required: true
  },
  user: {
    type: Types.ObjectId,
    ref: 'User',
    required: true
  },
  request_date: {
    type: String,
    required: true
  },
  approved: {
    type: Boolean,
    default: false,
  },
  approvedBy: {
    type: Types.ObjectId,
    ref: 'User'
  },
  approved_date: {
    type: String
  }
});

const Request = mongoose.model('Request', requestSchema);

module.exports = { requestSchema, Request };
