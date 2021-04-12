# chat-web-socket

# Server Side Sockets
## Listener
  ### loggedIn (handle user login)
    data:
      -user object in session or local storage.
## Emitter
  ### updateUserList
    data:
      - connected contacts
    
  ### updateGroupList
    data:
      - group array from db

## Listener
  ### create (create private room for 1-1 chats)
    data:
      - room (generated string)
      - withUserId (receipient id)
      - userId (logged in user id)
    
## Emitter
  ### invite
    data:
      same as create listener

## Listener
  ### joinRoom (join the private chat automatically)
    data:
    - same as create listener
    
## Listener
  ### message
    data:
      - room (id of the private room)
      - message (messsage text)
      - from (loggedInUser object)
    
## Emitter
  ### message (emit new message to private room)
    data:
      same as message listener
    
    

# Client Side Sockets

## Emitter
  ### loggedin (user logged in)
    data:
      - login response data
    
## Emitter
  ### message (emit new message from private room)
    data:
      - room (private room id)
      - message (message text)
      - from (logged in user object)
    
## Emitter
  ### create
    data:
      - room (private room id)
      - userId (logged in user id)
      - withUserId (receipient id)


## Listener
  ### invite (invite user to room)
    data:
      - same received from server side create listener
    
## Emitter
  ### joinRoom (user and receipient has joined private room)
    data:
      - received data in the invite listener
    

## Listener
  ### updateUserList (online users list)
    data:
      - array of online users
    

