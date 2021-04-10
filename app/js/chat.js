// jshint esversion:9
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
};

const sendMyMessage = (chatWidowId, fromUser, message) => {
    let loggedInUser = JSON.parse(sessionStorage.getItem('user'));
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

/* Group functions */
// open group add window
const generateGroupId = () => {
    return Math.floor(Math.random() * 10000);
};
const openAddGroupWindow = () => {
    let room = generateGroupId();
    const loggedInUser = JSON.parse(sessionStorage.getItem('user'));

    $('#after-login').append(`
        <div class="group-window">
            <h3>Enter Group Name</h3>
            <input type="text"/ id="group_name">
            <input type="text"/ id="group_desc" placholder="Group Description">
            <button type="button" onclick="createGroup('${loggedInUser.user_id}')">Create</button>
        </div>
        `);
};

// open group window
const openGroupWindow = (group_id, group_name, groupId) => {
    console.log('93: ', group_name, group_id);
    $('#after-login').append(`
        <div class="chat-window" id="${group_id}">
            <div class="chat_with_user">
                <h3>${group_name} <span id="addUserBtn-${group_id}" style="display:none;" onclick="openAddUsersWindow('${group_id}')"></span></h3>
            </div>
            <div class="body">
                <h3>Participants</h3>
                <div id="participants-${group_id}"></div>
            </div>
            <div class="footer">
                <input type="text" class="messageText"/><button>GO</button>
            </div>
        </div>
        `);
    socket.emit('fetchParticipants', { group_id: groupId }, function (err, res) {
        if (err) {
            alert('An error occured');
            console.log(err);
            return -1;
        }
        console.log(res);
    });
};

// open add users to group function
const openAddUsersWindow = (group_id) => {
    console.log('120: ', group_id);
    const loggedInUser = JSON.parse(sessionStorage.getItem('user'));
    console.log('122: ', loggedInUser);
    $('#after-login').append(`
    <div class="chat-window" id="add-user-${group_id}" style="display: block; margin-top: 20px;">
        <div class="chat_with_user">
            <h3>Add User To Group></h3>
        </div>
    </div>
    `);

    $.ajax({
        url: '/fetch-contacts',
        method: 'GET',
        success: (response) => {
            if (response.status) {
                $(`#add-user-${group_id}`).html('<ul></ul>');
                response.users.forEach((user) => {
                    $(`#add-user-${group_id}`).append(`<li data-id="${user.user_id}" onclick="addUserToGroup('${group_id}', '${user.user_id}', '${loggedInUser._id}')">${user.user_full_name}</li>`);
                });
            }
        }
    });
};

// Create group
const createGroup = (userId) => {
    const groupName = $('#group_name');
    const group_description = $('#group_desc');
    const roomDetails = {
        group_name: groupName.val().trim(),
        group_description: group_description.val().trim(),
        group_icon: ''
    };
    socket.emit('createGroup', { roomDetails, user_id: userId }, function (err, responseData) {
        if (err) {
            alert('An error occured');
            console.log(err);
            return -1;
        }
        // console.log('Group Created', responseData);
        // const { group, participant } = responseData;
        // socket.emit('fetchGroups', { user_id: participant.participant });
    });
};

// Add user to group (Admin function)
function addUserToGroup(group_id, user_id, adminId) {
    if (!group_id || !user_id) {
        alert('Please select a user');
        return;
    }

    socket.emit('addUserToGroup', { group_id, user_id, admin: adminId }, function(err, responseData) {
        if(err) {
            alert('An error occured');
            console.log(err);
        }
    });
}



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
socket.on('groupCreated', function (data, err) {
    if (err) {
        console.log(err);
        return -1;
    }
    console.log('Group Created', data);
    const { group, participant } = data;
    socket.emit('fetchGroups', { user_id: participant.participant }, function (err, res) {
        if (err) {
            alert('An error occured');
            console.log(err);
            return -1;
        }
        console.log(res);
    });
});

socket.on('updateGroupsList', function (data, err) {
    console.log(data);
    if (err) {
        alert('An error occured');
        console.log(err);
        return -1;
    }
    $('#group-list').html('<ul></ul>');
    data.groups.forEach((group) => {
        console.log('244: ', group);
        $('#group-list ul').append(`<li data-id="${group.group_id}" onclick="openGroupWindow('${group.group_id}', '${group.group_name}', '${group._id}')">${group.group_name}</li>`);
    });
});

socket.on('updateParticipants', function (data, err) {
    if (err) {
        alert('An error occured');
        console.log(err);
    }
    $(`#participants-${data.group_id}`).html('<ul></ul>');
    const loggedInUser = JSON.parse(sessionStorage.getItem('user'));
    console.log('224: ', loggedInUser);
    const loggedInUserInGroup = data.participants.find((x) => x.participant.first_name === loggedInUser.first_name);
    console.log('226: ', loggedInUserInGroup);
    if (loggedInUserInGroup && loggedInUserInGroup.isAdmin) {
        $(`#addUserBtn-${data.group_id}`).css('display', 'inline');
        $(`#addUserBtn-${data.group_id}`).css('font-weight', 'normal');
        $(`#addUserBtn-${data.group_id}`).css('margin-left', '5px');
        $(`#addUserBtn-${data.group_id}`).css('font-size', '13px');
        $(`#addUserBtn-${data.group_id}`).text('Add User');
        const updatedLoggedInUser = { ...loggedInUser };
        console.log('229: ', updatedLoggedInUser);
        updatedLoggedInUser.isAdmin = loggedInUserInGroup.isAdmin;
        sessionStorage.setItem('user', JSON.stringify(updatedLoggedInUser));
    }
    data.participants.forEach((participant) => {
        $(`#participants-${data.group_id}`).append(`<li data-id="${participant.participant_id}">${participant.participant.first_name}</li>`);
    });
});

socket.on('userAddedToGroup', function(data) {
    console.log('268: ', data);
    $(`#add-user-${data.new_participant.group_id}`).css('display', 'none');
    socket.emit('fetchParticipants', { group_id: data.new_participant.group_id });
});