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
const { GroupMessage } = require('./models/message.model');
const { Channel } = require('./models/channel.model');
const { PrivateRoom } = require('./models/privateRoom.model');
const { Socket } = require('./models/socket.model');

app.use(express.static('app'));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules',)));
app.use(express.json());

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
  console.log(user);
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
  console.log('conected');
  socket.on('disconnect', async () => {
    console.log("disconnected");
    try {
      const userSocket = await Socket.findOne({ socket: socket.id });
      if(userSocket) {
        const user = await User.findOne({ socket: userSocket._id });
        if(user) {
          const userUpdate = await User.findByIdAndUpdate(user._id, { active: false });
          const connectedUsers = await User.find({ active: true });
          io.emit('updateUserList', connectedUsers);
        }
      }
    } catch (error) {
      console.log(error);
    }
  });

  socket.on('loggedin', async function (user, cb) {
    // clientSocketIds.push({ socket: socket, userId: user.user_id });
    // connectedUsers = connectedUsers.filter(item => item.user_id != user.user_id);
    // connectedUsers.push({ ...user, socketId: socket.id });

    const userExists = await User.findById(user._id);

    if (userExists) {
      try {
        const clientSocketExist = await Socket.findOne({ user_id: user._id });
        console.log('146: ', clientSocketExist);
        if (!clientSocketExist) {
          const userSocket = await Socket.create({ socket: socket.id, user_id: user._id });
          console.log('149: ', userSocket);
          if (userSocket) {
            const userUpdate = await User.findByIdAndUpdate(user._id, { active: true, socket: userSocket._id });
            const connectedUsers = await User.find({ active: true });
            io.emit('updateUserList', connectedUsers);
          }
          return;
        }

        // update user socket and make user active
        const updatedClientSocket = await Socket.findOneAndUpdate({ user_id: user._id }, { socket: socket.id });
        if(updatedClientSocket) {
          const userUpdate = await User.findByIdAndUpdate(user._id, { active: true });
          console.log('162', socket.id);
          const newClientSocket = await Socket.findOne({ user_id: user._id });
          console.log('164: ', newClientSocket.socket);
          const connectedUsers = await User.find({ active: true });
          io.emit('updateUserList', connectedUsers);
          return;
        }
      } catch (error) {
        console.log(error);
        cb(error, null);
        return;
      }

      try {
        const participant = await Participant.find({ participant: user._id });
        console.log('146: ', participant);
        const groups = [];
        for (let i = 0; i < participant.length; i++) {
          const group = await Group.findById(participant[i].group_id);
          console.log('150: ', group);
          if (group) {
            console.log('152: ', group);
            groups.push(group);
          }
        }
        console.log('156: ', groups);
        socket.emit('updateGroupsList', { groups });
      } catch (error) {
        console.log(error);
        cb(error, null);
      }
    }

  });

  socket.on('create', async function (data, cb) {
    console.log(data);
    data.room = uuid.v4(); // replace room id with unique id
    // Create room in db
    if (data.isPrivate) {
      try {
        const user = await User.findOne({ user_id: data.userId });
        const receipientUser = await User.findOne({ user_id: data.withUserId }).populate('socket');

        if (user && receipientUser) { // check if both users exists
          const chatExists = await PrivateRoom.findOne({ user_id: user._id, with_user_id: receipientUser._id }); // check if chat exists between users
          console.log('204: ', chatExists);
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
        console.log(error);
        cb(error, null);
        return;
      }
    }

    if (data.isChannel) {
      console.log(data);
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
            console.log(participant);
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
    console.log('280: ', data);
    socket.join(data.room.room_id);
  });

  socket.on('message', function (data) {
    console.log(data);
    socket.broadcast.to(data.room).emit('message', data);
  });

  /* GROUP CHAT SOCKET */

  // Get all groups created by user
  socket.on('fetchGroups', async function (data, cb) {
    console.log('Hello');
    const { user_id } = data;
    try {
      const participant = await Participant.find({ participant: user_id });
      console.log('Participants: ', participant);
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
      const groupParticipants = await Participant.find({ group_id: data.group_id }).execPopulate('participant');
      const socketsInRoom = await io.in(group.group_id).fetchSockets();
      const usersSocketNotInRoom = [];
      if (groupParticipants) {
        for (let i = 0; i < groupParticipants.length; i++) {
          const socketNotInRoom = socketsInRoom.filter((socket) => socket.id !== groupParticipants[i].participant.socket);
          usersSocketNotInRoom.push(socketNotInRoom);
        }
        console.log('299: ', socketsInRoom);
        console.log('300: ', groupParticipants);
        socket.emit('updateParticipants', { participants: groupParticipants, group_id: group.group_id });
        return -1;
      }
    } catch (error) {
      console.log(error);
      cb(error, null);
    }
  });

  // Add users to group (Admin)
  socket.on('addUserToGroup', async function (data, cb) {
    console.log(data);
    // validate if required data is passed
    if (!data.group_id || !data.user_id || !data.admin) {
      cb({ error: 'one or more fields are missing' });
      return -1;
    }

    try {
      // find group, user, participant
      const group = await Group.findOne({ group_id: data.group_id });
      const user = await User.findOne({ user_id: data.user_id });
      const adminUser = await User.findById(data.admin);
      const userGroups = await Participant.find({ participant: user._id }).populate('group');
      const participantGroups = await Participant.find({ participant: data.admin });
      console.log('263: ', adminUser);

      if (group && user && adminUser) {
        let userExists;
        // Find if user exists in group
        for (let i = 0; i < userGroups.length; i++) {
          const userExistsInGroup = await Participant.findOne({ group_id: group._id, participant: user._id }).populate('participant group_id');
          console.log('269: ', userExistsInGroup);
          if (userExistsInGroup) {
            cb({ error: 'user exists in group' }, null);
            userExists = true;
            break;
          }
        }

        if (userExists) {
          return;
        }

        console.log('277: ', userExists);

        let isAdmin;
        // Verify if participant is an admin
        for (let i = 0; i < participantGroups.length; i++) {
          const participantIsAdmin = await Participant.findOne({ group_id: group._id, participant: adminUser._id });
          if (participantIsAdmin.isAdmin) {
            isAdmin = participantIsAdmin.isAdmin;
            console.log('286: ', isAdmin);
            process.env.isAdmin = JSON.stringify(isAdmin);
            break;
          }
        }

        if (isAdmin) { // only admins can add user
          // Create participant
          const participant_data = {
            participant_id: uuid.v4(),
            participant: user,
            group_id: group._id,
            joined_date: moment().format('dddd, MMMM Do YYYY, h:mm:ss a')
          };

          const new_participant = await (await Participant.create(participant_data)).populate('group');
          cb(null, { participant: new_participant });
          let withSocket = getSocketByUserId(user.user_id);
          socket.broadcast.to(withSocket.id).emit("invite", { room: { room: group.group_id, userId: adminUser.user_id, withUserId: user.user_id } });
          socket.emit('userAddedToGroup', { new_participant });
          return;
        }
        cb({ error: 'unauthorized' });
        return -1;
      }
      cb({ error: 'No such group or user' });
      return -1;
    } catch (error) {

    }
  });

  // socket.on('joinGroup', function (data) {

  // });

  socket.on('newGroupMessage', async function (data, cb) {
    console.log('326: ', data);
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
        console.log(message_data);
        console.log(participant._id);
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

});
/* socket function ends */

server.listen(8082, function () {
  console.log("server started");
});