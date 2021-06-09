// jshint esversion:9
const express = require('express');
const path = require('path');
const app = require('express')();
const server = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  allowEIO3: true
});
const mongoose = require('mongoose');
const uuid = require('uuid');
const moment = require('moment');
const { ExpressPeerServer, PeerServer } = require('peer');
const { User } = require('./models/users.model');
const { Group } = require('./models/group.model');
const { Participant } = require('./models/participant.model');
const { GroupMessage, Message } = require('./models/message.model');
const { PrivateRoom } = require('./models/privateRoom.model');
const { Socket } = require('./models/socket.model');
const { Request } = require('./models/request.model');
const winston = require('winston');
const CryptoJs = require('crypto-js');
const apiRouter = require('./routes/api');

const PORT = process.env.PORT || 8082;

console.log(process.env.NODE_ENV);

const peerServer = PeerServer({
  path: '/',
  port: 9000,
  proxied: true
});

app.set('view engine', 'ejs');
app.use(express.static('app'));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules',)));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/api', apiRouter());

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

console.log(process.env.NODE_ENV === 'production');
// mongoose initialization
mongoose.connect(process.env.NODE_ENV === 'production' ? `mongodb+srv://${process.env.MONGO_URI_USER}:${process.env.MONGO_URI_PWD}@cluster0.ok9ep.mongodb.net/ChatSocketDB?retryWrites=true&w=majority` : 'mongodb://localhost:27017/ChatDB', {
  useNewUrlParser: true,
  useFindAndModify: false,
  useUnifiedTopology: true,
  autoIndex: false
}).then((db) => {
  console.log('db connected successfully');
}).catch((err) => {
  console.log('Error connecting to db: ', err);
});

app.get('/', (req, res) => {
  res.redirect('/chat');
});

app.get('/chat', (req, res) => {
  return res.render('index');
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
    // @ts-ignore
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

app.all('**', (req, res) => {
  res.status(404).json({
    error: 'not found'
  });
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
  socket.emit('connected', { message: 'Hello' });
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
        cb({ error: error.message }, null);
      }
    }

  });

  async function createPrivateRoom(userId, withUserId) {
    const privateRoomData = { // new chat data
      room_id: uuid.v4(),
      user_id: userId,
      with_user_id: withUserId
    };
    const new_chat = await PrivateRoom.create(privateRoomData); // create chat
    return new_chat;
  }

  function sendRoomData(exisitingRoom, user, recipientUser, socket, cb) {
    const privateRoomData = { // chat data
      room_id: exisitingRoom.room_id,
      user_id: user._id,
      with_user_id: recipientUser._id
    };
    socket.join(exisitingRoom.room_id);
    socket.broadcast.to(recipientUser.socket.socket).emit('invite', { room: privateRoomData }); // emit invite to receipient to join chat
    cb(null, privateRoomData);
  }

  socket.on('create', async function (data, cb) {
    logger.info(data);
    data.room = uuid.v4(); // replace room id with unique id
    // Create room in db
    if (data.isPrivate) {
      try {
        const user = await User.findOne({ user_id: data.userId });
        const receipientUser = await User.findOne({ user_id: data.withUserId }).populate('socket');
        if (user && receipientUser) { // check if both users exists
          const userCreatedRoom = await PrivateRoom.findOne({ user_id: user._id, with_user_id: receipientUser._id }); // check if chat exists between users
          const userInvitedRoom = await PrivateRoom.findOne({ user_id: receipientUser._id, with_user_id: user._id });
          console.log('user created room: ', userCreatedRoom);
          console.log('user invited room: ', userInvitedRoom);
          // logger.info('user created room: ', userCreatedRoom);
          // logger.info('user invited room: ', userInvitedRoom);
          if (!userCreatedRoom && !userInvitedRoom) { // chat does not exist
            const privateRoom = await createPrivateRoom(user._id, receipientUser._id);
            socket.join(privateRoom.room_id); // join chat
            socket.broadcast.to(receipientUser.socket.socket).emit('invite', { room: privateRoom }); // emit invite to receipient to join chat
            cb(null, privateRoom);
            return;
          }
          // chat exists
          if (userCreatedRoom) {
            sendRoomData(userCreatedRoom, user, receipientUser, socket, cb);
            return;
          }

          if (userInvitedRoom) {
            sendRoomData(userInvitedRoom, user, receipientUser, socket, cb);
            return;
          }
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

  socket.on('joinRoom', async function (data) {
    logger.info('280: ', data);
    socket.join(data.room.room_id);
    const user = await User.findById(data.room.user_id);
    const withUser = await User.findById(data.room.with_user_id);
    socket.broadcast.to(data.room.room_id).emit('user-connected', { with_user_peer_id: withUser.peerId });
    socket.on('disconnect', () => {
      console.log('disconnected');
      socket.broadcast.to(data.room.room_id).emit('user-disconnected', user.peerId);
    });
  });

  socket.on('join-video', (roomId, userId) => {
    console.log(roomId, userId);
  });

  /**
   * Socket function to get all messages
  */

  socket.on('getmessages',
    /**
     * @param {{from_id: string, room_id: string, to_id: string}} data
     * @param {Function} cb
    */
    async (data, cb) => {
      const { from_id, to_id, room_id } = data;
      if (from_id === to_id) {
        const error = new Error('sender and recipient cannot be the same');
        cb({ error: error.message }, false);
        return;
      }
      try {
        const user = await User.findOne({ user_id: from_id });
        const recipientUser = await User.findOne({ user_id: to_id });
        const userCreatedRoom = await PrivateRoom.findOne({ room_id, user_id: user._id, with_user_id: recipientUser._id });
        const userInvitedRoom = await PrivateRoom.findOne({ room_id, user_id: recipientUser._id, with_user_id: user._id });
        if (!userCreatedRoom && !userInvitedRoom) {
          const error = new Error('no such room');
          cb({ error: error.message }, false);
          return;
        }
        if (user && recipientUser) {
          if (userCreatedRoom) {
            const messages = await Message.find({ room_id: userCreatedRoom._id }).populate('from_id to_id room_id');
            console.log('messages: ', messages);
            if (messages) {
              // Decrypt messages
              cb(null, { messages: messages });
              return;
            }
            const error = new Error('no messages between users');
            cb({ error: error.message }, false);
            return;
          }
          if (userInvitedRoom) {
            const messages = await Message.find({ room_id: userInvitedRoom._id }).populate('from_id to_id room_id');
            if (messages) {
              // Decrypt messages
              cb(null, { messages });
              return;
            }
            const error = new Error('no messages between users');
            cb({ error: error.message }, false);
            return;
          }
        }
      } catch (error) {
        console.log(error.message);
        cb({ error: 'an error occured' }, false);
        return;
      }
    });


  /**
   * Socket function for handling sending and recieving messages 
  */
  socket.on('message',
    /**
     * @param {{from_id: string, to_id: string, message: string, room: string}} data
     */
    async function (data, cb) {
      const {
        from_id,
        message,
        to_id,
        room
      } = data;
      console.log(from_id, to_id, message, room);
      if (from_id === to_id) {
        const error = new Error('sender and recipient cannot be the same');
        cb({ error: error.message }, false);
        return;
      }
      console.log('Encrypted message: ', message);
      // decrypt message
      const rabbitEnc = CryptoJs.AES.decrypt(message, process.env.AES_CRYPTO_SECRET).toString(CryptoJs.enc.Utf8);
      const decryptedMessage = CryptoJs.Rabbit.decrypt(rabbitEnc, process.env.RABBIT_CRYPTO_SECRET).toString(CryptoJs.enc.Utf8);
      console.log('decrypted message: ', decryptedMessage);
      // save message in db or something
      const user = await User.findOne({ user_id: from_id });
      const recipientUser = await User.findOne({ user_id: to_id });
      const chatRoom = await PrivateRoom.findOne({ room_id: room });
      if (user && recipientUser && chatRoom) {
        const recipientSocket = await Socket.findOne({ user_id: recipientUser._id });
        if (recipientSocket) {
          const message_data = {
            message_id: uuid.v4(),
            from_id: user._id,
            to_id: recipientUser._id,
            room_id: chatRoom._id,
            message_text: message,
          };
          const new_message = await (await Message.create(message_data)).execPopulate({
            path: 'from_id to_id room_id'
          });
          if (new_message) {
            // send back encrypted message
            // @ts-ignore
            const result = { ...new_message._doc };
            delete result.from_id._doc.password;
            delete result.to_id._doc.password;
            const finalResult = {
              message_id: result.message_id,
              from: result.from_id,
              to: result.to_id,
              room: result.room_id.room_id,
              message_text: result.message_text
            };
            io.to(recipientSocket.socket).emit('message', finalResult);
            cb(null, new_message);
          }
        }
      }
      const error = new Error('no such users or room');
      cb({ error: error.message }, null);
    });

  /**
   * Socket function for editing messages 
  */
  socket.on('editmessage',
    /** 
   * @param {{from_id: string, to_id: string, room_id: string, message: string, message_id: string}} data
   * @param {(error: *, data: *) => void} cb
  */
    async (data, cb) => {
      console.log('edit data: ', data);
      const { message_id, to_id, message, from_id } = data;

      if (!message_id || !to_id || !message || !from_id) {
        cb({ error: 'one or more params missing' }, false);
        return;
      }

      const user = await User.findOne({ user_id: from_id });
      const recipientUser = await User.findOne({ user_id: to_id });

      if (!user && !recipientUser) {
        cb({ error: 'invalid user ids' }, false);
        return;
      }
      // find users room
      const userCreatedRoom = await PrivateRoom.findOne({ user_id: user._id, with_user_id: recipientUser._id });
      const userInvitedRoom = await PrivateRoom.findOne({ user_id: recipientUser._id, with_user_id: user._id });
      if (!userCreatedRoom && !userInvitedRoom) {
        cb({ error: 'no such rooms' }, false);
        return;
      }
      if (userCreatedRoom) {
        const userSocket = await Socket.findOne({ user_id: user._id });
        const recipientSocket = await Socket.findOne({ user_id: recipientUser._id });
        if (recipientSocket) {
          const messageUpdate = await Message.findOneAndUpdate({ message_id }, { message_text: message, edited: true });
          console.log(messageUpdate);
          // @ts-ignore
          if (messageUpdate) {
            messageUpdate.edited = true;
            messageUpdate.message_text = message;
            io.to(userSocket.socket).emit('editmessage', messageUpdate);
            io.to(recipientSocket.socket).emit('editmessage', messageUpdate);
            return;
          }
        }
        const error = new Error('recipient does not exist');
        cb(error, false);
        return;
      }
    });

  /**
   * socket function to like a message
   */
  socket.on('likemessage',
    /**
     * 
     * @param {{message_id: string}} data 
     * @param {(err: *, data: *) => void} cb
     */
    async (data, cb) => {
      const { message_id } = data;
      console.log(message_id);
      if (!message_id) {
        const error = new Error('missing message id');
        cb({ error }, false);
        return;
      }
      try {
        const message = await Message.findOne({ message_id });
        const userSocket = await Socket.findOne({ user_id: message.from_id });
        const recipientSocket = await Socket.findOne({ user_id: message.to_id });
        if (!message) {
          const error = new Error('invalid message id');
          cb({ error }, false);
          return;
        }

        const likeMessage = await Message.findByIdAndUpdate(message._id, { liked: !message.liked });
        if (!likeMessage) {
          const error = new Error('could not like message');
          cb({ error }, false);
          return;
        }
        const likeStatus = !likeMessage.liked;
        io.to(userSocket.socket).emit('likemessage', { likeStatus, message_id });
        io.to(recipientSocket.socket).emit('likemessage', { likeStatus, message_id });

      } catch (error) {
        console.log(error.message);
        cb({ error: error.message }, false);
        return;
      }
    });

  /**
   * socket function to delete a message
   */
  socket.on('deletemessage',
    /**
     * 
     * @param {{message_id: string}} data 
     * @param {(error: *, data: *) => void} cb 
     */
    async (data, cb) => {
      const { message_id } = data;
      if (!message_id) {
        cb({ error: 'missing message id' }, false);
        return;
      }
      const deletedMessage = await Message.findOneAndDelete({ message_id });
      console.log(deletedMessage);
      const userSocket = await Socket.findOne({ user_id: deletedMessage.from_id });
      const recipientSocket = await Socket.findOne({ user_id: deletedMessage.to_id });
      if (!deletedMessage) {
        cb({ error: 'invalid message id' }, false);
        return;
      }
      if(!userSocket || !recipientSocket) {
        cb({ error: 'cannot get user or recipient socket' }, false);
        return;
      }
      io.to(userSocket.socket).emit('deletemessage', { deleteStatus: true });
      io.to(recipientSocket.socket).emit('deletemessage', { deleteStatus: true });
      return;
    });

  /**
   * socket function to handle message reply
   */
  socket.on('replymessage',
    /**
     * 
     * @param {{message_id: string, message: string, from_id: string, to_id: string, room_id: string}} data 
     * @param {(error: *, data: *) => void} cb 
     */
    async (data, cb) => {
      const { message_id, from_id, message, to_id, room_id } = data;
      if (!message_id || !from_id || !message || !to_id || !room_id) {
        cb({ error: 'missing message id' }, false);
        return;
      }
      try {
        const user = await User.findOne({ user_id: from_id });
        const recipientUser = await User.findOne({ user_id: to_id });
        const parentMessage = await Message.findOne({ message_id });
        const room = await PrivateRoom.findOne({ room_id });
        if (!parentMessage || !user || !recipientUser) {
          cb({ error: 'invalid from_id or to_id or message_id' }, false);
          return;
        }

        // find users socket ids
        const userSocket = await Socket.findById(user.socket);
        const recipientSocket = await Socket.findById(recipientUser.socket);
        if (!userSocket && !recipientSocket) {
          cb({ error: 'unable to find users socket ids' }, false);
          return;
        }
        // create reply
        const reply_data = {
          message_id: uuid.v4(),
          message_text: message,
          from_id: user._id,
          to_id: recipientUser._id,
          room_id: room._id,
          replied: true,
          parent_id: parentMessage._id
        };

        const reply = await (await Message.create(reply_data)).execPopulate({
          path: 'room_id from_id to_id parent_id'
        });
        if (reply) {
          const result = { ...reply._doc };
          console.log(result);
          delete result.from_id._doc.password;
          delete result.to_id._doc.password;
          const finalResult = {
            message_id: result.message_id,
            from: result.from_id,
            to: result.to_id,
            room: result.room_id.room_id,
            message_text: result.message_text,
            parent_message: result.parent_id
          };
          io.to(userSocket.socket).emit('message', finalResult);
          io.to(recipientSocket.socket).emit('message', finalResult);
          return;
        }
      } catch (error) {
        console.log('Error: ', error);
        cb({ error: 'an error occured' }, false);
      }
    });

  /**
   * socket function to get encryption keys
   */
  socket.on('getenckeys', (data, cb) => {
    console.log(data);
    const k1 = process.env.AES_CRYPTO_SECRET;
    const k2 = process.env.RABBIT_CRYPTO_SECRET;
    cb(null, { k1, k2 });
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

  socket.on('makeParticipantAdmin', async function (data, cb) {
    try {
      const group = await Group.findById(data.group_id);
      const participant = await Participant.findOne({ participant_id: data.participant_id, group_id: group._id });
      const adminParticipant = await Participant.findOne({ participant_id: data.admin_id, group_id: group._id, isAdmin: true });

      logger.info(adminParticipant);
      logger.info(group);
      logger.info(participant);
      if (group && participant && adminParticipant) {
        try {
          // update participant admin status
          const updatedParticipant = await Participant.findByIdAndUpdate(participant._id, { isAdmin: !participant.isAdmin }).populate('group_id');
          if (updatedParticipant) {
            updatedParticipant.isAdmin = !updatedParticipant.isAdmin;
            if (updatedParticipant.isAdmin) {
              cb(null, updatedParticipant);
              return;
            }
            cb(null, { updatedParticipant, message: 'User is no longer an admin' });
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

  socket.on('leaveGroup', async function (data, cb) {
    try {
      const group = await Group.findOne({ group_id: data.group_id });
      const participant = await Participant.findOne({ group_id: group._id, participant: data.user_id }).populate('participant');

      if (group && participant) {
        const deletedParticipant = await Participant.findByIdAndDelete(participant._id);
        const request = await Request.findOne({ user: data.user_id, group: group._id });
        logger.info(`user request ${request}`);
        logger.info(deletedParticipant);
        if (deletedParticipant) {
          if (request) {
            const deleteRequest = await Request.findByIdAndDelete(request._id);
            if (deleteRequest) {
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

  socket.on('call user', async ({ roomId, user, type, stream }) => {
    console.log('call data: ', roomId, user, stream);
    socket.broadcast.to(roomId).emit('incoming call', { roomId, user, type });
  });

  socket.on('call answered', function (data) {
    console.log('call data: ', data);
    socket.broadcast.to(data.roomId).emit('call answered', { roomId: data.roomId, type: data.type });
  });

});
/* socket function ends */

server.listen(PORT, function () {
  logger.info("server started");
});