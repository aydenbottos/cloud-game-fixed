/**
 * Game room module.
 * @version 1
 */
const room = (() => {
    let id = '';

    // UI
    const roomLabel = $('#room-txt');

    // !to rewrite
    const parseURLForRoom = () => {
        let queryDict = {};
        let regex = /^\/?([A-Za-z]*)\/?/g;
        var zone = regex.exec(location.pathname)[1]
        var room = null

        // get room from URL
        location.search.substr(1)
            .split('&')
            .forEach((item) => {
                queryDict[item.split('=')[0]] = item.split('=')[1]
            });

        if (typeof queryDict.id === 'string') {
            room =  decodeURIComponent(queryDict.id);
        }

        return [room, zone];
    };

    event.sub(GAME_ROOM_AVAILABLE, data => {
        room.setId(data.roomId);
        room.save(data.roomId);
    }, 1);

    return {
        getId: () => id,
        setId: (id_) => {
            id = id_;
            roomLabel.val(id);
        },
        reset: () => {
            id = '';
            roomLabel.val(id);
        },
        save: (roomIndex) => {
            localStorage.setItem('roomID', roomIndex);
            const drone = new ScaleDrone('558QL8Y1xngrAZCb');

            const roomName = "observable-" + localStorage.getItem('roomID');
            const configuration = { iceServers: [ { urls: ["turn:numb.viagenie.ca:3478","stun:numb.viagenie.ca:3478"], username: "aydenbottos12@gmail.com", credential: "ayden2006" } ] };
            let chatroom;
            let pc;


            function onSuccess() {};
            function onError(error) {
              console.error(error);
            };

            drone.on('open', error => {
              if (error) {
                return console.error(error);
              }
              chatroom = drone.subscribe(roomName);
              chatroom.on('open', error => {
                if (error) {
                  onError(error);
                }
              });
              // We're connected to the room and received an array of 'members'
              // connected to the room (including us). Signaling server is ready.
              chatroom.on('members', members => {
                console.log('MEMBERS', members);
                // If we are the second user to connect to the room we will be creating the offer
                const isOfferer = members.length === 2;
                startWebRTC(isOfferer);
              });
            });

            // Send signaling data via Scaledrone
            function sendMessage(message) {
              drone.publish({
                room: roomName,
                message
              });
            }

            function startWebRTC(isOfferer) {
              pc = new RTCPeerConnection(configuration);

              // 'onicecandidate' notifies us whenever an ICE agent needs to deliver a
              // message to the other peer through the signaling server
              pc.onicecandidate = event => {
                if (event.candidate) {
                  sendMessage({'candidate': event.candidate});
                }
              };

              // If user is offerer let the 'negotiationneeded' event create the offer
              if (isOfferer) {
                pc.onnegotiationneeded = () => {
                  pc.createOffer().then(localDescCreated).catch(onError);
                }
              }

              // When a remote stream arrives display it in the #remoteVideo element
              pc.ontrack = event => {
                const stream = event.streams[0];
                if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
                  remoteVideo.srcObject = stream;
                }
              };

              navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true,
              }).then(stream => {
                // Display your local video in #localVideo element
                localVideo.srcObject = stream;
                // Add your stream to be sent to the conneting peer
                stream.getTracks().forEach(track => pc.addTrack(track, stream));
              }, onError);

              // Listen to signaling data from Scaledrone
              chatroom.on('data', (message, client) => {
                // Message was sent by us
                if (client.id === drone.clientId) {
                  return;
                }

                if (message.sdp) {
                  // This is called after receiving an offer or answer from another peer
                  pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
                    // When receiving an offer lets answer it
                    if (pc.remoteDescription.type === 'offer') {
                      pc.createAnswer().then(localDescCreated).catch(onError);
                    }
                  }, onError);
                } else if (message.candidate) {
                  // Add the new ICE candidate to our connections remote description
                  pc.addIceCandidate(
                    new RTCIceCandidate(message.candidate), onSuccess, onError
                  );
                }
              });
            }

            function localDescCreated(desc) {
              pc.setLocalDescription(
                desc,
                () => sendMessage({'sdp': pc.localDescription}),
                onError
              );
            }

        },
        load: () => localStorage.getItem('roomID'),
        getLink: () => window.location.href.split('?')[0] + `?id=${encodeURIComponent(room.getId())}`,
        loadMaybe: () => {
            // localStorage first
            //roomID = loadRoomID();

            // Shared URL second
            const [parsedId, czone] = parseURLForRoom();
            if (parsedId !== null) {
                id = parsedId;
            }
            if (czone !== null) {
                zone = czone;
            }

            return [id, zone];
        },
        copyToClipboard: () => {
            const el = document.createElement('textarea');
            el.value = room.getLink();
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
        }
    }
})(document, event, location, localStorage, window);
