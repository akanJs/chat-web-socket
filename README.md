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
### joinRoom (join the private chat)
  data:
    - same as create listener
    
## Listener
### message
  data:
    - room (id of the private room)
    - message (messsage text)
    - from (loggedInUser object)
    
## Emitter
### message
  data:
    same as message listener
    
    

# Client Side Sockets

## Emitter
### loggedin
  data:
    - login response data
    
## Emitter
### message
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
### invite
  data:
    same received from server side create listener
    
## Emitter
### joinRoom
  data:
    received data in the invite listener
    

## Listener
### updateUserList
  data:
    - array of online users
    

