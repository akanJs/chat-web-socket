// jshint esversion:9
const login = () => {
    let username = $('#login_name').val();
    let password = $('#login_pass').val();
    $.ajax({
        type: "POST",
        url: "http://localhost:8082/login",
        data: JSON.stringify({
            "username": username,
            "password": password
        }),
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
                socket.emit('loggedin', resp.data, function (err) {
                    alert('An error occured');
                    console.log(err);
                });
                return;
            }

            alert(resp.error);
        },
        error: (error) => {
            alert('An error occured');
            console.log(error);
        },
        dataType: "json",
        contentType: "application/json"
    });
};

const searchGroup = () => {
    const groupName = $('#groupName').val().trim();
    $.ajax({
        method: 'GET',
        url: 'http://localhost:8082/get-group',
        data: {
            groupName
        },
        success: (response) => {
            console.log(response);
            if (response.status) {
                if (response.groups.length === 0) {
                    alert('No group found');
                    return;
                }
                const loggedInUser = JSON.parse(sessionStorage.getItem('user'));
                $('#search-group-result').html('<ul></ul>');
                response.groups.forEach((group) => {
                    $(`#search-group-result ul`).append(`<li data-id="${group.group_id}" onclick="requestToJoinGroup('${group.group_id}', '${loggedInUser.user_id}')">${group.group_name}</li>`);
                });
            }
        },
        error: (error) => {
            alert('An error occured');
            console.log(error);
        }
    });
};

const requestToJoinGroup = (group_id, user_id) => {
    console.log(group_id, user_id);
    socket.emit('requestToJoinGroup', {
        group_id,
        user_id
    }, function (err, responseData) {
        if (err) {
            alert('An error occured');
            console.log(err);
            return;
        }
        console.log(responseData);
    });
};

const sendMyMessage = (chatWidowId, fromUser, message) => {
    let loggedInUser = {...JSON.parse(sessionStorage.getItem('user'))};
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
    socket.emit('message', {
        room: room,
        message: message,
        from: loggedInUser
    });
    sendMyMessage(room, loggedInUser, message);
};

// Group Messages
const sendGroupMessage = (group_id) => {
    const user = JSON.parse(sessionStorage.getItem('user'));
    const message = $('#groupMsgSendBtn').val().trim();

    const data = {
        sent_by: user._id,
        message_text: message,
        group: group_id
    };

    socket.emit('newGroupMessage', data, function (err, responseData) {
        if (err) {
            alert('An error occured');
            console.log(err);
            return;
        }
        console.log('73: ', responseData);
    });
};


// Open chat screen
const openChatWindow = (room, username) => {
    console.log(room, username);
    console.log('openChatWindow: ', {
        room
    });
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
                <h3>${group_name} <span id="addUserBtn-${group_id}" style="display:none;" onclick="openAddUsersWindow('${group_id}')"></span> <small onclick="leaveGroup('${group_id}')">Leave group</small></h3>
            </div>
            <div class="body">
                <h3>Participants</h3>
                <div id="participants-${group_id}"></div>
                <div id="requests-${group_id}"></div>
                <div id="messages-${group_id}"></div>
            </div>
            <div class="footer">
                <input type="text" class="messageText" id="groupMsgSendBtn"/><button onclick="sendGroupMessage('${groupId}')">GO</button>
            </div>
        </div>
        `);
    socket.emit('fetchParticipants', {
        group_id: groupId
    }, function (err, res) {
        if (err) {
            alert('An error occured');
            console.log(err);
            return -1;
        }
        console.log(res);
    });

    socket.emit('fetchGroupMessages', {
        group_id: groupId
    }, function (err, responseData) {
        if (err) {
            alert('An error occured');
            console.log(err);
            return;
        }
        console.log(responseData);
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
    socket.emit('create', {
        roomDetails,
        userId,
        isChannel: true
    }, function (err, responseData) {
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
function addUserToGroup(group_id, user_id, adminId, approval) {
    const loggedInUser = JSON.parse(sessionStorage.getItem('user'));
    if (!group_id || !user_id) {
        alert('Please select a user');
        return;
    }

    socket.emit('addUserToGroup', {
        group_id,
        user_id,
        admin: adminId,
        approval: approval ? approval : null
    }, function (err, responseData) {
        if (err) {
            alert('An error occured');
            console.log(err);
            return;
        }

        console.log(responseData);
        const loggedInUserInGroup = responseData.participants.find((x) => x.participant.username === loggedInUser.username);

        if (responseData.requests) {
            $(`#requests-${group_id} ul`).empty();
            responseData.requests.forEach((request) => {
                console.log(request);
                $(`#requests-${group_id}`).append(`<li data-id="${request._id}" onclick="addUserToGroup('${group_id}', '${request.user.user_id}', '${loggedInUser._id}', '${approval}')">${request.user.user_full_name} ${loggedInUserInGroup.isAdmin ? '<small>accept</small>' : ''}</li>`);
            });
        }
    });
}

const makeParticipantAdmin = (group_id, participant_id, admin_id) => {
    if (!group_id || !participant_id || !admin_id) {
        alert('One or more fields missing');
        return;
    }
    socket.emit('makeParticipantAdmin', {
        group_id,
        participant_id,
        admin_id
    }, function (err, responseData) {
        if (err) {
            alert('An error occured');
            console.log(err);
            return;
        }
        console.log(responseData);
        alert(responseData.message ? `${responseData.message}` : `User is now an admin`);
    });
};

const leaveGroup = group_id => {
    const loggedInUser = JSON.parse(sessionStorage.getItem('user'));
    socket.emit('leaveGroup', { group_id, user_id: loggedInUser._id }, function(err, responseData) {
        if(err) {
            alert('An error occured');
            console.log(err);
            return;
        }
    });
};



// Function to create room
const createRoom = (id, username) => {
    let loggedInUser = JSON.parse(sessionStorage.getItem('user'));
    let room = Date.now() + Math.random();
    room = room.toString().replace(".", "_");
    socket.emit('create', {
        room: room,
        userId: loggedInUser.user_id,
        withUserId: id,
        isPrivate: true
    }, function (err, responseData) {
        if (err) {
            alert('An error occured');
            console.log(err);
            return;
        }
        openChatWindow(responseData.room_id, username);
    });
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
    console.log('228: ', data);
    socket.emit("joinRoom", data);
});
socket.on('message', function (msg) {
    console.log('onMessageSocket: ', {
        msg
    });
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
        alert('An error occured');
        console.log(err);
        return -1;
    }
    console.log('Group Created', data);
    const {
        group,
        participant
    } = data;
    socket.emit('fetchGroups', {
        user_id: participant.participant
    }, function (err, res) {
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
        $('#group-list ul').append(`<li data-id="${group.group_id}" onclick="openGroupWindow('${group.group_id}', '${group.group_name}', '${group._id}')">${group.group_name}</li>`);
    });
});

socket.on('updateParticipants', function (data, err) {
    console.log(data);
    if (err) {
        alert('An error occured');
        console.log(err);
    }
    $(`#participants-${data.group_id}`).html('<ul></ul>');
    const loggedInUser = JSON.parse(sessionStorage.getItem('user'));
    const loggedInUserInGroup = data.participants.find((x) => x.participant.first_name === loggedInUser.first_name);
    if (loggedInUserInGroup && loggedInUserInGroup.isAdmin) {
        $(`#addUserBtn-${data.group_id}`).css('display', 'inline');
        $(`#addUserBtn-${data.group_id}`).css('font-weight', 'normal');
        $(`#addUserBtn-${data.group_id}`).css('margin-left', '5px');
        $(`#addUserBtn-${data.group_id}`).css('font-size', '13px');
        $(`#addUserBtn-${data.group_id}`).text('Add User');
        const updatedLoggedInUser = {
            ...loggedInUser
        };
        console.log('229: ', updatedLoggedInUser);
        updatedLoggedInUser.isAdmin = loggedInUserInGroup.isAdmin;
        sessionStorage.setItem('user', JSON.stringify(updatedLoggedInUser));
    }
    data.participants.forEach((participant) => {
        console.log('loggedInUser: ', loggedInUserInGroup);
        $(`#participants-${data.group_id}`).append(`
            <li id="${participant.participant_id}" data-id="${participant.participant_id}">
            ${participant.participant.first_name} ${participant.isAdmin ? '(Admin)' : ''} ${loggedInUserInGroup.isAdmin && participant.participant.user_id !== loggedInUserInGroup.participant.user_id  && !participant.isAdmin ? `<small onclick="makeParticipantAdmin('${participant.group_id}', '${participant.participant_id}', '${loggedInUserInGroup.participant_id}')">
            (Make Admin)</small>` : loggedInUserInGroup.isAdmin && participant.participant.user_id !== loggedInUserInGroup.participant.user_id  && participant.isAdmin ? 
            `<small onclick="makeParticipantAdmin('${participant.group_id}', '${participant.participant_id}', '${loggedInUserInGroup.participant_id}')">
            (Remove Admin)</small>` : ''
            }
            </li>
        `);
    });

    socket.emit('fetchJoinRequests', {
        group: data.groupId
    }, function (err, responseData) {
        if (err) {
            alert('An error occured');
            console.log(err);
            return -1;
        }
        console.log(data.group_id);
        $(`#requests-${data.group_id}`).html('<ul></ul>');
        const approval = true;
        responseData.requests.forEach((request) => {
            $(`#requests-${data.group_id}`).append(`<li data-id="${request._id}" onclick="addUserToGroup('${data.group_id}', '${request.user.user_id}', '${loggedInUser._id}', '${approval}')">${request.user.user_full_name} ${loggedInUserInGroup.isAdmin ? '<small>accept</small>' : ''}</li>`);
        });
        console.log(responseData);
    });
});

socket.on('userAddedToGroup', function (data) {
    console.log('268: ', data);
    $(`#add-user-${data.new_participant.group_id}`).css('display', 'none');
    socket.emit('fetchParticipants', {
        group_id: data.new_participant.group_id
    });
});

socket.on('newGroupMessage', function (data) {
    console.log(data);
    alert(`New message from ${data.message.sent_by.participant.first_name} in ${data.message.group.group_name}`);
});

socket.on('notify', function(data) {
    const loggedInUser = JSON.parse(sessionStorage.getItem('user'));
    const messageParts = data.message.split(' ');
    console.log(loggedInUser.username);
    console.log(messageParts);
    if(loggedInUser.username === messageParts[0]) {
        const newMessage = data.message.replace(loggedInUser.username, 'You');
        alert(newMessage);
        return;
    }
    alert(data.message);
});