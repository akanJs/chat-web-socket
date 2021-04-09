const login = () => {
    let username = $('#login_name').val();
    let password = $('#login_pass').val();
    $.ajax({
        type: "POST",
        url: "http://localhost:8082/login",
        data: JSON.stringify({ "username": username, "password": password }),
        success: function (resp) {
            if (resp.status) {
                $('#login').hide();
                $('#after-login').show();
                sessionStorage.setItem("user", JSON.stringify(resp.data));
                $('#me').html(`
                        <div class="me">
                            <img src="${resp.data.user_img}" />
                            ${resp.data.user_full_name}
                         </div>
                         `);
                socket.emit('loggedin', resp.data);
                return;
            }

            alert(resp.error);
        },
        dataType: "json",
        contentType: "application/json"
    });
}

const sendMyMessage = (chatWidowId, fromUser, message) => {
    let loggedInUser = JSON.parse(sessionStorage.getItem('user'))
    let meClass = loggedInUser.user_id == fromUser.user_id ? 'me' : '';

    $('#after-login').find(`#${chatWidowId} .body`).append(`
        <div class="chat-text ${meClass}">
            <div class="userPhoto">
                <img src="${fromUser.user_img}" />
            </div>
            <div>
                <span class="message">${message}<span>
            </div>
        </div>
    `);
};

// Send message
const sendMessage = (room) => {
    let loggedInUser = JSON.parse(sessionStorage.getItem('user'));
    let message = $('#' + room).find('.messageText').val();
    $('#' + room).find('.messageText').val('');
    socket.emit('message', { room: room, message: message, from: loggedInUser });
    sendMyMessage(room, loggedInUser, message);
};

// Open chat screen
const openChatWindow = (room, username) => {
    console.log('openChatWindow: ', { room });
    if ($(`#${room}`).length === 0) {
        $('#after-login').append(`
        <div class="chat-window" id="${room}">
            <div class="chat_with_user">
                <h3>${username}</h3>
            </div>
            <div class="body"></div>
            <div class="footer">
                <input type="text" class="messageText"/><button onclick="sendMessage('${room}')">GO</button>
            </div>
        </div>
        `);
    }
};

const openAddGroupWindow = () => {
    let room = Date.now() + Math.random();
    room = room.toString().replace(".", "_");
    const loggedInUser = JSON.parse(sessionStorage.getItem('user'));

    $('#after-login').append(`
        <div class="group-window">
            <h3>Enter Group Name</h3>
            <input type="text"/ id="group_name">
            <button type="button" onclick="createGroup('${room}', '${loggedInUser.user_id}')">Create</button>
        </div>
        `);
};

const createGroup = (room, userId) => {
    const groupName = $('#group_name');
    const roomDetails = {
        group_id: room,
        group_name: groupName.val().trim(),
        group_descriiption: '',
        group_photo: ''
    };
    socket.emit('createGroup', { roomDetails, user_id: userId }, function(err, responseData) {
        if(err) {
            alert('An error occured');
            console.log(err);
            return -1;
        }
        console.log(responseData);
    });
};

// Function to create room
const createRoom = (id, username) => {
    let loggedInUser = JSON.parse(sessionStorage.getItem('user'));
    console.log(loggedInUser);
    let room = Date.now() + Math.random();
    room = room.toString().replace(".", "_");
    socket.emit('create', { room: room, userId: loggedInUser.user_id, withUserId: id });
    openChatWindow(room, username);
};
socket.on('updateUserList', function (userList) {
    let loggedInUser = JSON.parse(sessionStorage.getItem('user'));
    $('#user-list').html('<ul></ul>');
    userList.forEach(item => {
        if (loggedInUser.user_id != item.user_id) {
            $('#user-list ul').append(`<li data-id="${item.user_id}" onclick="createRoom('${item.user_id}', '${item.first_name}')">${item.user_full_name}</li>`);
        }
    });

});

socket.on('invite', function (data) {
    socket.emit("joinRoom", data);
});
socket.on('message', function (msg) {
    console.log('onMessageSocket: ', { msg });
    alert(`New message from ${msg.from.first_name}`);
    //If chat window not opened with this roomId, open it
    if (!$('#after-login').find(`#${msg.room}`).length) {
        openChatWindow(msg.room, msg.from.username);
    }
    sendMyMessage(msg.room, msg.from, msg.message);
});

// group socket
socket.on('groupCreated', function(data, err) {
    console.log(data);
    if(err) {
        console.log(err);
    }
});