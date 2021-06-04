// jshint esversion:9

const socket = io({
	transports: ['websocket']
});

localStorage.setItem('sendType', 'message');

const myPeer = new Peer(undefined, {
	host: '/',
	port: '3001'
});

console.log('peer id: ', myPeer.id);

myPeer.on('open', id => {
	console.log('peer: ', id);
	// store user peerId to localstorage
	localStorage.setItem('peerId', id);

});

const login = () => {
	let username = $('#login_name').val();
	let password = $('#login_pass').val();
	$.ajax({
		type: "POST",
		url: "/login",
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

				const id = localStorage.getItem('peerId');
				socket.emit('loggedin', { user: resp.data, peerId: id }, function (err, data) {
					if (err) {
						alert('An error occured');
						return;
					}
					console.log(data);
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

$('#loginBtn').on('click', login);

const searchGroup = () => {
	const groupName = $('#groupName').val().trim();
	$.ajax({
		method: 'GET',
		url: '/get-group',
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

$('#searchBtn').on('click', searchGroup);

const setMessageParams = (type, message_id) => {
	localStorage.setItem('sendType', type);
	localStorage.setItem('message_id', message_id);
	console.log($(`#${message_id}`).text());
	$('#messageInp').val($(`#${message_id}`).text());
};

const likeMessage = (message_id) => {
	socket.emit('likemessage', {
		message_id
	}, (err, data) => {
		if (err) {
			console.log(err);
			return;
		}
	});
};

const deleteMessage = (message_id) => {
	socket.emit('deletemessage', {
		message_id
	}, (err, data) => {
		if(err) {
			console.log(err);
			return;
		}
		console.log(data);
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

/**
 * 
 * @param {string} chatWidowId 
 * @param {object} fromUser 
 * @param {string} message 
 */
const pushMyMessage = (chatWidowId, fromUser, message, message_id = null, likeStatus = false) => {
	console.log(chatWidowId, fromUser, message);
	let loggedInUser = { ...JSON.parse(sessionStorage.getItem('user')) };
	let meClass = loggedInUser.user_id == fromUser.user_id ? 'me' : '';

	$('#after-login').find(`#${chatWidowId} .body`).append(`
        <div class="chat-text ${meClass}">
            <div class="userPhoto">
                <img src="${fromUser.user_img}" />
            </div>
            <div>
                <span id="${message_id}" class="message">${message}</span>
								<span onclick="setMessageParams('${'edit'}', '${message_id}')" style="font-size: 10px">(edit)</span>
								<span onclick="likeMessage('${message_id}')" style="font-size: 10px">${likeStatus ? '(unlike)' : '(like)'}</span>
								<span onclick="setMessageParams('${'reply'}', '${message_id}')" style="font-size: 10px">(reply)</span>
								<span onclick="deleteMessage('${message_id}')" style="font-size: 10px">(delete)</span>
            </div>
        </div>
  `);
};

// Send message
const sendMessage = (room, to_id, message_id = null) => {
	let loggedInUser = JSON.parse(sessionStorage.getItem('user'));
	let message = $('#' + room).find('.messageText').val();
	$('#' + room).find('.messageText').val('');

	// Get cryptojs keys
	socket.emit('getenckeys', {}, (err, resp) => {
		if (err) {
			console.log(err);
			return;
		}
		// destructure keys
		const { k1, k2 } = resp;
		const rabbitEnc = CryptoJS.Rabbit.encrypt(message, k2).toString();
		const encryptedMessage = CryptoJS.AES.encrypt(rabbitEnc, k1).toString();
		console.log(encryptedMessage);
		// Send message to backend
		const type = localStorage.getItem('sendType');
		if (type === 'message') {
			socket.emit('message', {
				room: room,
				message: encryptedMessage,
				from_id: loggedInUser ? loggedInUser.user_id : null,
				to_id
			}, function (err, msg) {
				if (err) {
					console.log(err);
					return;
				}
				console.log('message sent: ', msg);
				const { message_text } = msg;
				const rabbitEnc = CryptoJS.AES.decrypt(message_text, k1).toString(CryptoJS.enc.Utf8);
				const decryptedMessage = CryptoJS.Rabbit.decrypt(rabbitEnc, k2).toString(CryptoJS.enc.Utf8);
				console.log('decrypted message: ', decryptedMessage);
				pushMyMessage(room, loggedInUser, decryptedMessage, msg.message_id);
			});
		}

		if (type === 'edit') {
			socket.emit('editmessage', {
				from_id: loggedInUser ? loggedInUser.user_id : null,
				to_id,
				message: encryptedMessage,
				message_id: localStorage.getItem('message_id')
			}, (err, msg) => {
				if (err) {
					console.log(err);
					return;
				}
				console.log(msg);
			});
		}

		if(type === 'reply') {
			socket.emit('replymessage', {
				from_id: loggedInUser ? loggedInUser.user_id : null,
				to_id,
				message: encryptedMessage,
				room_id: room,
				message_id: localStorage.getItem('message_id')
			}, (err, data) => {
				if(err) {
					console.log(err);
					return;
				}
				console.log(data);
			});
		}
	});
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
const openChatWindow = (room, from) => {
	const loggedInUser = JSON.parse(sessionStorage.getItem('user'));
	socket.emit('getmessages', {
		from_id: from.user_id,
		to_id: loggedInUser ? loggedInUser.user_id : null,
		room_id: room
	}, (err, data) => {
		if (err) {
			console.log(err);
			return;
		}
		console.log(data);
		if ($(`#${room}`).length === 0) {
			$('#after-login').append(`
            <div class="chat-window" id="${room}">
                <div class="chat_with_user">
                    <h3 id="${from.user_id}">${from.username}
                        <small onclick="startCall('${room}', '${from.peerId}', 'video')">(video call)</small>
                        <small onclick="startCall('${room}', '${from.peerId}' 'audio')">(Voice call)</small>
                    </h3>
                </div>
                <div class="body"></div>
                <div class="footer">
                    <input type="text" id="messageInp" class="messageText"/><button onclick="sendMessage('${room}', '${from.user_id}', '${localStorage.getItem('message_id')}')">GO</button>
                </div>
            </div>
            `);
		}
		socket.emit('getenckeys', {}, (errr, respData) => {
			if (errr) {
				console.log(errr);
				return;
			}
			const { k1, k2 } = respData;
			data.messages.forEach((msg) => {
				console.log('message sent: ', msg);
				const { message_text } = msg;
				const rabbitEnc = CryptoJS.AES.decrypt(message_text, k1).toString(CryptoJS.enc.Utf8);
				const decryptedMessage = CryptoJS.Rabbit.decrypt(rabbitEnc, k2).toString(CryptoJS.enc.Utf8);
				console.log('decrypted message: ', decryptedMessage);
				pushMyMessage(msg.room_id.room_id, msg.from_id, decryptedMessage, msg.message_id, msg.liked);
			});
		});
	});
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

$('#create-group').on('click', openAddGroupWindow);

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
	socket.emit('leaveGroup', { group_id, user_id: loggedInUser._id }, function (err, responseData) {
		if (err) {
			alert('An error occured');
			console.log(err);
			return;
		}
	});
};



// Function to create room
const createRoom = (userId, userUsername, peerId) => {
	let loggedInUser = JSON.parse(sessionStorage.getItem('user'));
	let room = Date.now() + Math.random();
	room = room.toString().replace(".", "_");
	socket.emit('create', {
		room: room,
		userId: loggedInUser.user_id,
		withUserId: userId,
		isPrivate: true
	}, function (err, responseData) {
		if (err) {
			alert('An error occured');
			console.log(err);
			return;
		}
		const userDetails = { user_id: userId, username: userUsername, peerId: peerId };
		openChatWindow(responseData.room_id, userDetails);
	});
};


socket.on('updateUserList', function (userList) {
	let loggedInUser = JSON.parse(sessionStorage.getItem('user'));
	$('#user-list').html('<ul></ul>');
	userList.forEach(item => {
		if (loggedInUser.user_id != item.user_id) {
			$('#user-list ul').append(`<li data-id="${item.user_id}" onclick="createRoom('${item.user_id}', '${item.username}', '${item.peerId}')">${item.user_full_name}</li>`);
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
	alert(`New message from ${msg.from.username}`);
	//If chat window not opened with this roomId, open it
	if ($('#after-login').find(`#${msg.room}`).length) {
		socket.emit('getenckeys', {}, (err, resp) => {
			if (err) {
				console.log(err);
				return;
			}
			// destructure keys
			const { k1, k2 } = resp;
			const rabbitEnc = CryptoJS.AES.decrypt(msg.message_text, k1).toString(CryptoJS.enc.Utf8);
			const decryptedMessage = CryptoJS.Rabbit.decrypt(rabbitEnc, k2).toString(CryptoJS.enc.Utf8);
			console.log('decrypted message: ', decryptedMessage);
			pushMyMessage(msg.room, msg.from, decryptedMessage, msg.message_id);
		});
	}
});

socket.on('editmessage', (msg) => {
	socket.emit('getenckeys', {}, (err, data) => {
		if(err) {
			console.log(err);
			return;
		}
		const { k1, k2 } = data;
		console.log('message sent: ', msg);
		const { message_text } = msg;
		const rabbitEnc = CryptoJS.AES.decrypt(message_text, k1).toString(CryptoJS.enc.Utf8);
		const decryptedMessage = CryptoJS.Rabbit.decrypt(rabbitEnc, k2).toString(CryptoJS.enc.Utf8);
		console.log('decrypted message: ', decryptedMessage);
		$(`#${msg.message_id}`).text(decryptedMessage);
		localStorage.removeItem('message_id');
		localStorage.setItem('sendType', 'message');
	})
});

socket.on('likemessage', (data) => {
	const { likeStatus, message_id } = data;
	const messageParentEl = document.getElementById(message_id).parentElement;
	for (let el of messageParentEl.children) {
		console.log(el.innerHTML);
		if (el.innerHTML === '(like)' || el.innerHTML === '(unlike)') {
			console.log(likeStatus);
			el.innerHTML = likeStatus ? '(unlike)' : '(like)';
			break;
		}
	}
});

socket.on('deletemessage', (data) => {
	console.log('message deleted: ', data);
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
            ${participant.participant.first_name} ${participant.isAdmin ? '(Admin)' : ''} ${loggedInUserInGroup.isAdmin && participant.participant.user_id !== loggedInUserInGroup.participant.user_id && !participant.isAdmin ? `<small onclick="makeParticipantAdmin('${participant.group_id}', '${participant.participant_id}', '${loggedInUserInGroup.participant_id}')">
            (Make Admin)</small>` : loggedInUserInGroup.isAdmin && participant.participant.user_id !== loggedInUserInGroup.participant.user_id && participant.isAdmin ?
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

socket.on('notify', function (data) {
	const loggedInUser = JSON.parse(sessionStorage.getItem('user'));
	const messageParts = data.message.split(' ');
	console.log(loggedInUser.username);
	console.log(messageParts);
	if (loggedInUser.username === messageParts[0]) {
		const newMessage = data.message.replace(loggedInUser.username, 'You');
		alert(newMessage);
		return;
	}
	alert(data.message);
});


const peers = {};
let chunck = [];

async function getStream(type) {
	console.log(type);
	if (type === 'video') {
		const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
		return stream;
	}
	const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
	return stream;
}

const videoGrid = document.getElementById('video-grid');

socket.on('user-connected', ({ with_user_peer_id }) => {
	console.log('user connected');
	localStorage.setItem('with_user_peer_id', with_user_peer_id);

});

socket.on('user-disconnected', (userId) => {
	console.log('user disconnected');
	console.log(peers[userId]);
	if (peers[userId]) peers[userId].close();
	localStorage.removeItem('peerId');
});

function openIncomingCallWindow(roomId, user, type) {
	console.log(roomId, user);
	$('#callerName').text(`Incoming ${type.toLowerCase()} call from ${user.username}`);
	const callerImg = document.createElement('img');
	callerImg.src = user.user_img;
	callerImg.style.width = '100%';
	$('#callerImg').append(callerImg);
	$('#incomingCallModal').modal('toggle');

	$('#acceptCallBtn').on('click', async (e) => {
		e.preventDefault();
		if (type === 'video') {
			const stream = await getStream(type);
			const myVideo = document.createElement('video');
			addVideoStream(myVideo, stream);
			$('#incomingCallModal').modal('hide');
			socket.emit('call answered', { roomId, type });
			return;
		}
		const stream = await getStream(type);
		converToAudio(stream);
		$('#incomingCallModal').modal('toggle');
		socket.emit('call answered', { roomId, type });
	});

	$('#declineCallBtn').on('click', (e) => {
		e.preventDefault();
		socket.emit('call declined', { roomId });
		$('#incomingCallModal').modal('toggle');
	});
}


socket.on('incoming call', (data) => {
	console.log(data);
	openIncomingCallWindow(data.roomId, data.user, data.type);
});

socket.on('call answered', async (data) => {
	console.log('call has been answered');
	const userPeerId = localStorage.getItem('with_user_peer_id');
	const stream = await getStream(data.type);
	localStorage.setItem('callType', data.type);
	connectToNewUser(userPeerId, stream, data.type);
});

myPeer.on('call', async call => {
	const stream = await getStream(localStorage.getItem('callType'));
	call.answer(stream);
	call.on('stream', mediaStream => {
		if (localStorage.getItem('callType') === 'video') {
			console.log('from on call listener function: ', mediaStream);
			const video = document.createElement('video');
			addVideoStream(video, mediaStream);
			return;
		}
		converToAudio(mediaStream);
	});
});

async function startCall(roomId, peerId, type) {
	const loggedInUser = JSON.parse(sessionStorage.getItem('user'));
	if (type === 'video') {

		// navigator.getUserMedia({ video: true, audio: true }, (stream) => {
		//     const call = myPeer.call(peerId, stream);
		//     call.on('stream', (remoteStream) => {
		//         alert('new video call');
		//         const video = document.createElement('video');
		//         addVideoStream(video, remoteStream);
		//     });
		// }, (err) => {
		//     console.log('could not getStream');
		// });
		console.log('type is video');
		const myVideo = document.createElement('video');
		myVideo.muted = false;
		const stream = await getStream(type);
		console.log(stream);
		// emit new call to user
		addVideoStream(myVideo, stream);
		socket.emit('call user', { roomId, user: loggedInUser, type });
		return;
	}
	const stream = await getStream(type);
	converToAudio(stream);
	socket.emit('call user', { roomId, user: loggedInUser, type });
}

function addVideoStream(video, stream) {
	video.srcObject = stream;
	video.addEventListener('loadedmetadata', () => {
		video.play();
	});
	videoGrid.append(video);
}


async function converToAudio(stream) {
	const mediaRecorder = new MediaRecorder(stream);
	const audio = new Audio();
	audio.crossOrigin = 'anonymous';
	mediaRecorder.start();
	chunck = [];
	mediaRecorder.ondataavailable = handleDataAvailable;
	const blob = new Blob(chunck, { 'type': 'audio/ogg; codecs=opus' });
	const audioURL = window.URL.createObjectURL(blob);
	console.log(blob, audio, audioURL);
	audio.src = audioURL;
	console.log('audio will play now');
	try {
		const audioIsPlaying = await audio.play();
		console.log(audioIsPlaying);
	} catch (error) {
		console.log(error);
	}
}

async function connectToNewUser(userId, stream, type) {
	console.log(userId, stream, type);
	const call = myPeer.call(userId, stream);
	call.on('stream', mediaStream => {
		if (type === 'video') {
			const video = document.createElement('video');
			addVideoStream(video, mediaStream);
			return;
		}
		console.log('call streaming', mediaStream);
		converToAudio(mediaStream);
	});
	call.on('close', () => {
		video.remove();
	});

	peers[userId] = call;
}

function handleDataAvailable(event) {
	if (event.data.size > 0) {
		chunck.push(event.data);
	}
}