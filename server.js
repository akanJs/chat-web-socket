// jshint esversion:9
let express = require('express');
const path = require('path');
const app = require('express')();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const mongoose = require('mongoose');
const uuid = require('uuid');
const moment = require('moment');
const { User } = require('./models/users.model');
const { Group } = require('./models/group.model');
const { Participant } = require('./models/participant.model');
const { GroupMessage } = require('./models/message.model')
const { PrivateRoom } = require('./models/privateRoom.model');
const { Socket } = require('./models/socket.model');
const { Request } = require('./models/request.model');
const winston = require('winston');

app.use(express.static('app'));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules',)));
app.use(express.json());

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { from: 'server' },
  transports: [
    //
    // - Write all logs with level `error` and below to `error.log`
    // - Write all logs with level `info` and below to `combined.log`
    //
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// If we're not in production then log to the `console` with the format:
//  `${info.level}: ${info.message} JSON.stringify({ ...rest }) `;


if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.prettyPrint()
  }));
}

let clientSocketIds = [];
let connectedUsers = [];

// mongoose initialization
mongoose.connect('mongodb://localhost:27017/ChatDB', {
  useNewUrlParser: true,
  useFindAndModify: false,
  useUnifiedTopology: true,
  autoIndex: false
});

app.post('/register', async (req, res) => {
  const user = await User.findOne({ username: req.body.username });
  logger.info(user);
  if (user) {
    return res.json({
      status: false,
      error: 'user with that username exists'
    });
  }

  const newUser = { ...req.body };
  newUser.user_id = uuid.v4();
  newUser.user_img = newUser.first_name === 'Jack' ? '/images/jack.jpg' : newUser.first_name === 'Philip' ? '/images/philip.jpg' : '/images/shanon.jpg';
  newUser.user_full_name = `${newUser.first_name} ${newUser.last_name}`;
  try {
    const result = await User.create(newUser);
    delete result.password;
    return res.json({
      status: true,
      data: {
        message: 'user created',
        user: result
      }
    });
  } catch (error) {
    return res.json({
      status: false,
      error
    });
  }

});


app.get('/get-group', async (req, res) => {
  logger.info(req.query);
  const { groupName } = req.query;

  try {
    const requestedGroup = await Group.find();
    const groups = requestedGroup.filter((x) => x.group_name.toUpperCase().includes(groupName.toUpperCase()));
    if (requestedGroup) {
      return res.status(200).json({
        status: true,
        groups: groups
      });
    }
    return res.status(404).json({
      status: false,
      error: 'No group found'
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

app.get('/fetch-contacts', async (req, res) => {
  try {
    const users = await User.find();
    if (users) {
      return res.status(200).json({
        status: true,
        users
      });
    }
  } catch (error) {
    return res.status(500).json({
      status: false,
      error
    });
  }
});

app.post('/login', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.body.username });
    if (user && user.password === req.body.password) {
      return res.json({
        status: true,
        data: user
      });
    }
    return res.json({
      status: false,
      error: 'incorrect username or password'
    });
  } catch (error) {
    return res.json({
      status: false,
      error: error.message
    });
  }
});

const getSocketByUserId = (userId) => {
  let socket = '';
  for (let i = 0; i < clientSocketIds.length; i++) {
    if (clientSocketIds[i].userId == userId) {
      socket = clientSocketIds[i].socket;
      break;
    }
  }
  return socket;
};

/* socket function starts */
io.on('connection', socket => {
  logger.info('conected');
  socket.on('disconnect', async () => {
    logger.info("disconnected");
    try {
      const userSocket = await Socket.findOne({ socket: socket.id });
      if (userSocket) {
        const user = await User.findOne({ socket: userSocket._id });
        if (user) {
          const userUpdate = await User.findByIdAndUpdate(user._id, { active: false });
          const connectedUsers = await User.find({ active: true });
          io.emit('updateUserList', connectedUsers);
        }
      }
    } catch (error) {
      logger.error(error);
    }
  });

  socket.on('loggedin', async function (data, cb) {
    // clientSocketIds.push({ socket: socket, userId: user.user_id });
    // connectedUsers = connectedUsers.filter(item => item.user_id != user.user_id);
    // connectedUsers.push({ ...user, socketId: socket.id });

    const userExists = await User.findById(data.user._id);

    if (userExists) {
      try {
        const clientSocketExist = await Socket.findOne({ user_id: data.user._id });
        const userGroups = await Participant.find({ user_id: data.user._id });
        logger.info('146: ', clientSocketExist);
        if (!clientSocketExist) {
          const userSocket = await Socket.create({ socket: socket.id, user_id: data.user._id });
          logger.info('149: ', userSocket);
          if (userSocket) {
            const userUpdate = await User.findByIdAndUpdate(data.user._id, { active: true, socket: userSocket._id, peerId: data.peerId });
            const connectedUsers = await User.find({ active: true });
            io.emit('updateUserList', connectedUsers);
            // subscribe user to all his groups
            for (let i = 0; i < userGroups.length; i++) {
              const group = await Group.findById(userGroups[i].group_id);
              logger.info('157: ', group);
              socket.join(group.group_id);
            }
            return;
          }
        }

        // update user socket and make user active
        const updatedClientSocket = await Socket.findOneAndUpdate({ user_id: data.user._id }, { socket: socket.id });
        if (updatedClientSocket) {
          const userUpdate = await User.findByIdAndUpdate(data.user._id, { active: true, peerId: data.peerId });
          logger.info('169', socket.id);
          const newClientSocket = await Socket.findOne({ user_id: data.user._id });
          logger.info('171: ', newClientSocket.socket);
          const connectedUsers = await User.find({ active: true });
          io.emit('updateUserList', connectedUsers);
        }
      } catch (error) {
        logger.error(error);
        cb(error, null);
        return;
      }

      try {
        const participant = await Participant.find({ participant: data.user._id });
        logger.info('146: ', participant);
        const groups = [];
        for (let i = 0; i < participant.length; i++) {
          const group = await Group.findById(participant[i].group_id);
          logger.info('187: ', group);
          if (group) {
            logger.info('189: ', group);
            socket.join(group.group_id);
            groups.push(group);
          }
        }
        logger.info('194: ', groups);
        socket.emit('updateGroupsList', { groups });
      } catch (error) {
        logger.error(error);
        cb(error, null);
      }
    }

  });

  socket.on('create', async function (data, cb) {
    logger.info(data);
    data.room = uuid.v4(); // replace room id with unique id
    // Create room in db
    if (data.isPrivate) {
      try {
        const user = await User.findOne({ user_id: data.userId });
        const receipientUser = await User.findOne({ user_id: data.withUserId }).populate('socket');

        if (user && receipientUser) { // check if both users exists
          const chatExists = await PrivateRoom.findOne({ user_id: user._id, with_user_id: receipientUser._id }); // check if chat exists between users
          logger.info('204: ', chatExists);
          if (!chatExists) { // chat does not exist
            const privateRoomData = { // new chat data
              room_id: uuid.v4(),
              user_id: user._id,
              with_user_id: receipientUser._id
            };
            const new_chat = await PrivateRoom.create(privateRoomData); // create chat
            socket.join(new_chat.room_id); // join chat
            socket.broadcast.to(receipientUser.socket.socket).emit('invite', { room: privateRoomData }); // emit invite to receipient to join chat
            cb(null, privateRoomData);
          }

          // chat exists
          const privateRoomData = { // chat data
            room_id: chatExists.room_id,
            user_id: user._id,
            with_user_id: receipientUser._id
          };
          socket.join(chatExists.room_id);
          socket.broadcast.to(receipientUser.socket.socket).emit('invite', { room: privateRoomData }); // emit invite to receipient to join chat
          cb(null, privateRoomData);
          return;
        }

        cb({ error: 'both users do not exist' });
        return;
      } catch (error) {
        logger.error(error);
        cb(error, null);
        return;
      }
    }

    if (data.isChannel) {
      logger.info('243: ', data);
      try {
        // Find user in db
        const user = await User.findOne({ user_id: data.userId });
        const old_group = await Group.findOne({ group_name: data.roomDetails.group_name });

        if (user) {
          if (old_group) {
            cb({ error: 'Group already created by you!' });
            return -1;
          }
          // create group
          const group_data = {
            ...data.roomDetails,
            group_id: uuid.v4(),
            created_by: user,
            created_date: moment().format('dddd, MMMM Do YYYY, h:mm:ss a')
          };
          const group = await Group.create(group_data);
          process.env.group_id = group._id;

          // Create participant
          const participant_data = {
            participant_id: uuid.v4(),
            participant: user,
            group_id: group._id,
            isAdmin: true,
            joined_date: moment().format('dddd, MMMM Do YYYY, h:mm:ss a')
          };

          const participant = await Participant.create(participant_data);
          if (participant) {
            logger.info(participant);
            cb(null, { group, participant });
            socket.join(group.group_id);
            socket.emit('groupCreated', { group, participant });
            return;
          }
        }
      } catch (error) {
        cb(error);
        // Delete created group
        const deletedGroup = await Group.findByIdAndDelete(process.env.group_id);
        delete process.env.group_id;
      }
    }
  });

  socket.on('joinRoom', function (data) {
    logger.info('280: ', data);
    socket.join(data.room.room_id);
  });

  socket.on('join-video', (roomId, userId) => {
    console.log(roomId, userId);
    console.log('Socket: ', socket.broadcast);
    socket.broadcast.to(roomId).emit('user-connected', userId);
    socket.on('disconnect', () => {
      console.log('disconnected');
      socket.broadcast.to(roomId).emit('user-disconnected', userId);
    });
  });

  socket.on('message', function (data) {
    logger.info('message data', data);
    socket.broadcast.to(data.room).emit('message', data);
  });

  /* GROUP CHAT SOCKET */

  // Get all groups created by user
  socket.on('fetchGroups', async function (data, cb) {
    const { user_id } = data;
    logger.info('364: ', data);
    try {
      const participant = await Participant.find({ participant: user_id });
      logger.info('Participants: ', participant);
      const groups = [];
      for (let i = 0; i < participant.length; i++) {
        const group = await Group.findById(participant[i].group_id);
        if (group) {
          groups.push(group);
        }
      }

      socket.emit('updateGroupsList', { groups });
      return;
    } catch (error) {
      cb(error, null);
    }
  });

  // Fetch group participants
  socket.on('fetchParticipants', async function (data, cb) {
    try {
      const group = await Group.findById(data.group_id);
      const groupParticipants = await Participant.find({ group_id: data.group_id }).populate({
        path: 'participant',
        populate: {
          path: 'socket',
          model: 'Socket'
        }
      });
      if (groupParticipants) {
        socket.emit('updateParticipants', { participants: groupParticipants, group_id: group.group_id, groupId: group._id });
        return -1;
      }
    } catch (error) {
      logger.error(error);
      cb(error, null);
    }
  });

  // Add users to group (Admin)
  socket.on('addUserToGroup', async function (data, cb) {
    logger.info('357', data);
    // validate if required data is passed
    if (!data.group_id || !data.user_id || !data.admin) {
      cb({ error: 'one or more fields are missing' });
      return -1;
    }

    try {
      // find group, user, participant
      const group = await Group.findOne({ group_id: data.group_id });
      const user = await User.findOne({ user_id: data.user_id }).populate('socket');
      const adminUser = await User.findById(data.admin);
      if (group && user && adminUser) {
        // Find if user exists in group
        const userExistsInGroup = await Participant.findOne({ group_id: group._id, participant: user._id }).populate('participant group_id');
        logger.info('269: ', userExistsInGroup);
          if (userExistsInGroup) {
            cb({ error: 'user exists in group' }, null);
            return;
          }

        // Verify if participant is an admin
        const participantIsAdmin = await Participant.findOne({ group_id: group._id, participant: adminUser._id, isAdmin: true });
        if (participantIsAdmin) { // only admins can add user
          // Create participant
          const participant_data = {
            participant_id: uuid.v4(),
            participant: user,
            group_id: group._id,
            joined_date: moment().format('dddd, MMMM Do YYYY, h:mm:ss a')
          };

          const new_participant = await (await Participant.create(participant_data)).execPopulate('group participant');
          if (data.approval) {
            const updateRequest = await Request.findOneAndUpdate({ user: user._id, group: group._id }, { approved: true, approvedBy: adminUser._id, approved_date: moment().format('dddd, MMMM Do YYYY, h:mm:ss a') });
            logger.info('updatedRequest: ', updateRequest);
            if (updateRequest) {
              const requests = await Request.find({ group: group._id, approved: false });
              logger.info('Requests: ', requests);
              const groupParticipants = await Participant.find({ group_id: group._id }).populate({
                path: 'participant',
                populate: {
                  path: 'socket',
                  model: 'Socket'
                }
              });
              logger.info('447: ', groupParticipants, requests);
              cb(null, { participants: groupParticipants, requests });
              socket.broadcast.to(user.socket.socket).emit("invite", { room: { room_id: group.group_id, userId: adminUser.user_id, withUserId: user.user_id } });
              socket.emit('userAddedToGroup', { new_participant });
              socket.broadcast.to(group.group_id).emit('notify', { message: `${new_participant.participant.username} has been added to ${group.group_name}` });
              return;
            }
          }
          cb(null, { participant: new_participant });
          socket.broadcast.to(user.socket.socket).emit("invite", { room: { room_id: group.group_id, userId: adminUser.user_id, withUserId: user.user_id } });
          socket.emit('userAddedToGroup', { new_participant });
          socket.broadcast.to(group.group_id).emit('notify', { message: `${new_participant.participant.username} has been added to ${group.group_name}` });
          return;
        }
        cb({ error: 'unauthorized' });
        return -1;
      }
      cb({ error: 'No such group or user' });
      return -1;
    } catch (error) {
      console.log(error);
      logger.error(error);
      cb(error, null);
    }
  });

  // New group message
  socket.on('newGroupMessage', async function (data, cb) {
    logger.info('326: ', data);
    // save message
    try {
      const participant = await (await Participant.findOne({ participant: data.sent_by })).execPopulate('participant');
      const group = await Group.findById(data.group);
      if (participant && group) {
        const message_data = {
          ...data,
          sent_date: moment().format('dddd, MMMM Do YYYY, h:mm:ss a')
        };
        message_data.sent_by = participant._id;
        logger.info(message_data);
        logger.info(participant._id);
        const new_message = await (await GroupMessage.create(message_data)).execPopulate({
          path: 'group sent_by',
          populate: {
            path: 'participant',
            model: 'User'
          }
        });
        if (new_message) {
          cb(null, new_message);
          socket.broadcast.to(new_message.group.group_id).emit('newGroupMessage', { message: new_message });
          return;
        }
        return;
      }
      cb({ error: 'No such group or participant' }, null);
      return -1;
    } catch (error) {
      cb(error, null);
    }
  });

  socket.on('fetchGroupMessages', async function (data, cb) {
    logger.info(data);
    try {
      const messages = await GroupMessage.find({ group: data.group_id }).populate({
        path: 'group sent_by',
        populate: {
          path: 'participant',
          model: 'User'
        }
      });
      logger.info('474: ', messages);
      cb(false, messages);
      return;
    } catch (error) {
      cb(error, null);
    }
  });

  socket.on('fetchJoinRequests', async function (data, cb) {
    try {
      const requests = await Request.find({ group: data.group, approved: false }).populate('user');
      if (requests) {
        cb(null, { requests });
        return;
      }
      cb({ error: 'No requests' }, null);
      return;
    } catch (error) {
      cb({ error: error }, null);
      return;
    }
  });

  socket.on('requestToJoinGroup', async function (data, cb) {
    const { group_id, user_id } = data;
    try {
      const group = await Group.findOne({ group_id });
      const user = await User.findOne({ user_id });

      if (group && user) {

        // Check if user exists in group
        const userInGroup = await Participant.findOne({ group_id: group._id, participant: user._id });
        if (userInGroup) {
          cb({ error: 'User exists in group' }, null);
          return;
        }

        // check if user request exists
        const requestExist = await Request.findOne({ group: group._id, user: user._id });
        if (requestExist) {
          cb({ error: 'Cannot request twice' }, null);
          return;
        }
        const requestData = {
          group: group._id,
          user: user._id,
          request_date: moment().format('dddd, MMMM Do YYYY, h:mm:ss a')
        };
        const request = await Request.create(requestData);
        if (request) {
          cb(null, request);
          return;
        }
      }
      cb({ error: 'no such group or user' }, null);
      return;
    } catch (error) {
      cb({ error: error.message }, null);
    }
  });

  socket.on('makeParticipantAdmin', async function(data, cb) {
    try {
      const group = await Group.findById(data.group_id);
      const participant = await Participant.findOne({ participant_id: data.participant_id, group_id: group._id });
      const adminParticipant = await Participant.findOne({ participant_id: data.admin_id, group_id: group._id, isAdmin: true });

      logger.info(adminParticipant);
      logger.info(group);
      logger.info(participant);
      if(group && participant && adminParticipant) {
        try {
          // update participant admin status
          const updatedParticipant = await Participant.findByIdAndUpdate(participant._id, { isAdmin: !participant.isAdmin }).populate('group_id');
          if(updatedParticipant) {
            updatedParticipant.isAdmin = !updatedParticipant.isAdmin;
            if(updatedParticipant.isAdmin) {
              cb(null, updatedParticipant);
              return;
            }
            cb(null, { updatedParticipant, message: 'User is no longer an admin' })
            return;
          }
        } catch (error) {
          cb({ error }, null);
          return;
        }
      }
      cb({ error: 'No user or group or admin' }, null);
    } catch (error) {
      
    }
  });

  socket.on('leaveGroup', async function(data, cb) {
    try {
      const group = await Group.findOne({ group_id: data.group_id });
      const participant = await Participant.findOne({ group_id: group._id, participant: data.user_id }).populate('participant')

      if(group && participant) {
        const deletedParticipant = await Participant.findByIdAndDelete(participant._id);
        const request = await Request.findOne({ user: data.user_id, group: group._id });
        logger.info(`user request ${request}`);
        logger.info(deletedParticipant);
        if(deletedParticipant) {
          if(request) {
            const deleteRequest = await Request.findByIdAndDelete(request._id);
            if(deleteRequest) {
              logger.info(`Request has been deleted: ${deleteRequest}`);
            }
          }
          cb(null, deletedParticipant);
          socket.broadcast.to(group.group_id).emit('notify', { message: `${participant.participant.username} has left the group` });
          return;
        }
      }
    } catch (error) {
      
    }
  });

  socket.on('call user', async ({roomId, user, type }) => {
    console.log('call data: ', roomId, user);
    const sockets = await io.in(roomId).fetchSockets();
    console.log(sockets.length);
    socket.broadcast.to(roomId).emit('incoming call', { roomId, user, type });
  });

  socket.on('call answered', function(data) {
    console.log('call data: ', data);
    socket.broadcast.to(data.roomId).emit('call answered', { roomId: data.roomId, type: data.type });
  });

});
/* socket function ends */

server.listen(8082, function () {
  logger.info("server started");
});