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

app.use(express.static('app'));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules',)));
app.use(express.json());

let clientSocketIds = [];
let connectedUsers = [];

// mongoose initialization
mongoose.connect('mongodb://localhost:27017/ChatDB', {
  useNewUrlParser: true,
  useFindAndModify: true,
  useUnifiedTopology: true
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
  socket.on('disconnect', () => {
    console.log("disconnected");
    connectedUsers = connectedUsers.filter(item => item.socketId != socket.id);
    io.emit('updateUserList', connectedUsers);
  });

  socket.on('loggedin', function (user) {
    clientSocketIds.push({ socket: socket, userId: user.user_id });
    connectedUsers = connectedUsers.filter(item => item.user_id != user.user_id);
    connectedUsers.push({ ...user, socketId: socket.id });
    io.emit('updateUserList', connectedUsers);
  });

  socket.on('create', function (data) {
    console.log('create room');
    socket.join(data.room);
    let withSocket = getSocketByUserId(data.withUserId);
    socket.broadcast.to(withSocket.id).emit("invite", { room: data });
  });

  socket.on('joinRoom', function (data) {
    socket.join(data.room.room);
  });

  socket.on('message', function (data) {
    socket.broadcast.to(data.room).emit('message', data);
  });

  /* GROUP CHAT SOCKET */
  // Create group socket
  socket.on('createGroup', async function (data, cb) {
    console.log(data);
    try {
      // Find user in db
      const user = await User.findOne({ user_id: data.user_id });
      const old_group = await Group.findOne({ group_name: data.roomDetails.group_name });

      if (user) {
        if (old_group) {
          cb({ error: 'Group already created by you!' });
          return -1;
        }
        // create group
        const group_data = {
          ...data.roomDetails,
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
          return;
        }

        socket.join(group.group_id);

        socket.emit('groupCreated', { group, participant });
      }
    } catch (error) {
      cb(error);
      // Delete created group
      const deletedGroup = await Group.findByIdAndDelete(process.env.group_id);
      delete process.env.group_id;
    }
  });

  // Add users to group (Admin)
  socket.on('addUserToGroup', async function (data, cb) {
    // validate if required data is passed
    if (!data.group_id || !data.user_id || !data.admin) {
      cb({ error: 'one or more fields are missing' });
      return -1;
    }

    try {
      // find group, user, participant
      const group = await Group.findOne({ group_id: data.group_id });
      const user = await User.findOne({ user_id: data.user_id });
      const participant = Participant.findOne({ participant: data.admin });

      if (group && user) {
        if (participant.group_id === group._id) {
          cb({ error: 'user exist in group already' });
          return -1;
        }

        if (participant.isAdmin) { // only admins can add user
          // Create participant
          const participant_data = {
            participant_id: uuid.v4(),
            participant: user,
            group_id: group._id,
            joined_date: moment().format('dddd, MMMM Do YYYY, h:mm:ss a')
          };

          const new_participant = await Participant.create(participant_data);
          cb(null, { participant: new_participant });
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

  socket.on('joinGroup', function (data) {

  });

});
/* socket function ends */

server.listen(8082, function () {
  console.log("server started");
});