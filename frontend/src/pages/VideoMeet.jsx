import React, { useEffect, useRef, useState } from 'react'  // Import necessary React hooks and components
import io from "socket.io-client";  // Import socket.io-client for WebRTC signaling
import { Badge, IconButton, TextField } from '@mui/material';  // Import MUI components for UI
import { Button } from '@mui/material';  // Import Button component from MUI
import VideocamIcon from '@mui/icons-material/Videocam';  // Import video camera icon
import VideocamOffIcon from '@mui/icons-material/VideocamOff';  // Import video off icon
import styles from "../styles/videoComponent.module.css";  // Import CSS module for styling
import CallEndIcon from '@mui/icons-material/CallEnd';  // Import call end icon
import MicIcon from '@mui/icons-material/Mic';  // Import microphone icon
import MicOffIcon from '@mui/icons-material/MicOff';  // Import microphone off icon
import ScreenShareIcon from '@mui/icons-material/ScreenShare';  // Import screen share icon
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';  // Import stop screen share icon
import ChatIcon from '@mui/icons-material/Chat';  // Import chat icon
import server from '../environment';  // Import server URL from environment file

const server_url = server;  // Assign server URL to a constant

var connections = {};  // Create an object to store peer connections

const peerConfigConnections = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302" }  // Use Google's public STUN server for ICE candidates
    ]
}

export default function VideoMeetComponent() {
    var socketRef = useRef();  // Create a ref to store socket instance
    let socketIdRef = useRef();  // Store the current socket ID
    let localVideoref = useRef();  // Ref for local video element

    let [videoAvailable, setVideoAvailable] = useState(true);  // State to track video availability
    let [audioAvailable, setAudioAvailable] = useState(true);  // State to track audio availability
    let [video, setVideo] = useState([]);  // State to track video streams
    let [audio, setAudio] = useState();  // State to track audio streams
    let [screen, setScreen] = useState();  // State to track screen sharing
    let [showModal, setModal] = useState(true);  // Control visibility of modals
    let [screenAvailable, setScreenAvailable] = useState();  // Track if screen sharing is possible
    let [messages, setMessages] = useState([]);  // State to store chat messages
    let [message, setMessage] = useState("");  // State to manage input messages
    let [newMessages, setNewMessages] = useState(3);  // Track new incoming messages
    let [askForUsername, setAskForUsername] = useState(true);  // Control username prompt visibility
    let [username, setUsername] = useState("");  // Store username
    const videoRef = useRef([]);  // Ref for remote video elements
    let [videos, setVideos] = useState([]);  // Store remote video streams

    // useEffect to request permissions on component mount
    useEffect(() => {
        console.log("HELLO")  // Log message when component is rendered
        getPermissions();  // Call function to get video/audio permissions
    })

    // Function to handle screen sharing permissions
    let getDislayMedia = () => {
        if (screen) {  // Check if screen sharing is enabled
            if (navigator.mediaDevices.getDisplayMedia) {  // Check if screen capture is supported
                navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })  // Request screen and audio
                    .then(getDislayMediaSuccess)  // Handle success
                    .catch((e) => console.log(e))  // Log error if permission is denied
            }
        }
    }

    // Function to request media permissions
    const getPermissions = async () => {
        try {
            const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true });  // Request video
            if (videoPermission) {
                setVideoAvailable(true);  // Set video available if permission granted
                console.log('Video permission granted');
            } else {
                setVideoAvailable(false);  // Disable video if permission denied
                console.log('Video permission denied');
            }

            const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true });  // Request audio
            if (audioPermission) {
                setAudioAvailable(true);  // Set audio available if granted
                console.log('Audio permission granted');
            } else {
                setAudioAvailable(false);
                console.log('Audio permission denied');
            }

            if (navigator.mediaDevices.getDisplayMedia) {
                setScreenAvailable(true);  // Enable screen share if supported
            } else {
                setScreenAvailable(false);  // Disable if not supported
            }

            // Start local stream if permissions are granted
            if (videoAvailable || audioAvailable) {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({ video: videoAvailable, audio: audioAvailable });
                if (userMediaStream) {
                    window.localStream = userMediaStream;  // Store stream globally
                    if (localVideoref.current) {
                        localVideoref.current.srcObject = userMediaStream;  // Set video source to local stream
                    }
                }
            }
        } catch (error) {
            console.log(error);  // Catch and log errors
        }
    };

    // useEffect to request media when video/audio changes
    useEffect(() => {
        if (video !== undefined && audio !== undefined) {
            getUserMedia();  // Call to get user media when state changes
            console.log("SET STATE HAS ", video, audio);
        }
    }, [video, audio])  // Trigger effect when video or audio state updates

    // Initialize media streams and connect to socket server
    let getMedia = () => {
        setVideo(videoAvailable);  // Set video state
        setAudio(audioAvailable);  // Set audio state
        connectToSocketServer();  // Connect to socket
    }

    // Handle successful media retrieval
    let getUserMediaSuccess = (stream) => {
        try {
            window.localStream.getTracks().forEach(track => track.stop())  // Stop existing tracks
        } catch (e) { console.log(e) }

        window.localStream = stream  // Set new stream
        localVideoref.current.srcObject = stream  // Attach stream to video element

        // Add stream to peer connections
        for (let id in connections) {
            if (id === socketIdRef.current) continue;  // Skip if current socket

            connections[id].addStream(window.localStream);  // Add stream to peer connection

            // Create offer and send SDP
            connections[id].createOffer().then((description) => {
                connections[id].setLocalDescription(description).then(() => {
                    socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                }).catch(e => console.log(e))
            })
        }

        // Stop stream if tracks end
        stream.getTracks().forEach(track => track.onended = () => {
            setVideo(false);  // Disable video
            setAudio(false);  // Disable audio
        })
    }

    // Function to start video/audio stream
    let getUserMedia = () => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            navigator.mediaDevices.getUserMedia({ video: video, audio: audio })
                .then(getUserMediaSuccess)  // Handle successful media
                .catch((e) => console.log(e))
        }

        else {
            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { }
        }
    }





    // Function to handle successful screen sharing
    let getDislayMediaSuccess = (stream) => {
        console.log("HERE")
        try {
            // Stop any existing tracks in local stream
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        // Set new stream to local video
        window.localStream = stream
        localVideoref.current.srcObject = stream

        // Send the stream to all connected peers
        for (let id in connections) {
            if (id === socketIdRef.current) continue  // Skip self-connection

            // Add the stream to peer connection
            connections[id].addStream(window.localStream)

            // Create an SDP offer for the connection
            connections[id].createOffer().then((description) => {
                connections[id].setLocalDescription(description)
                    .then(() => {
                        // Emit SDP offer to the signaling server
                        socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                    })
                    .catch(e => console.log(e))
            })
        }

        // Handle stream ending
        stream.getTracks().forEach(track => track.onended = () => {
            setScreen(false)  // Turn off screen share state

            try {
                // Stop all video tracks
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }

            // Replace stream with black screen and silence
            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream

            getUserMedia()  // Restart user media capture
        })
    }

    // Function to handle incoming signals from server
    let gotMessageFromServer = (fromId, message) => {
        var signal = JSON.parse(message)

        if (fromId !== socketIdRef.current) {
            // If the signal is an SDP offer/answer
            if (signal.sdp) {
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                    if (signal.sdp.type === 'offer') {
                        // Respond to offer with an SDP answer
                        connections[fromId].createAnswer().then((description) => {
                            connections[fromId].setLocalDescription(description).then(() => {
                                socketRef.current.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription }))
                            }).catch(e => console.log(e))
                        }).catch(e => console.log(e))
                    }
                }).catch(e => console.log(e))
            }

            // Handle ICE candidates
            if (signal.ice) {
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e))
            }
        }
    }

    // Function to connect to socket server and handle signaling
    let connectToSocketServer = () => {
        socketRef.current = io.connect(server_url, { secure: false })  // Connect to server

        socketRef.current.on('signal', gotMessageFromServer)  // Listen for signals from server

        socketRef.current.on('connect', () => {
            socketRef.current.emit('join-call', window.location.href)  // Join call room
            socketIdRef.current = socketRef.current.id  // Store socket ID

            // Listen for chat messages
            socketRef.current.on('chat-message', addMessage)

            // Handle user disconnection
            socketRef.current.on('user-left', (id) => {
                setVideos((videos) => videos.filter((video) => video.socketId !== id))
            })

            // Handle new users joining
            socketRef.current.on('user-joined', (id, clients) => {
                clients.forEach((socketListId) => {
                    connections[socketListId] = new RTCPeerConnection(peerConfigConnections)

                    // Listen for ICE candidates
                    connections[socketListId].onicecandidate = function (event) {
                        if (event.candidate != null) {
                            socketRef.current.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }))
                        }
                    }

                    // Listen for video streams from other users
                    connections[socketListId].onaddstream = (event) => {
                        let videoExists = videoRef.current.find(video => video.socketId === socketListId)

                        if (videoExists) {
                            // Update existing video stream
                            setVideos(videos => {
                                const updatedVideos = videos.map(video =>
                                    video.socketId === socketListId ? { ...video, stream: event.stream } : video
                                )
                                videoRef.current = updatedVideos
                                return updatedVideos
                            })
                        } else {
                            // Create a new video entry for the user
                            let newVideo = {
                                socketId: socketListId,
                                stream: event.stream,
                                autoplay: true,
                                playsinline: true
                            }
                            setVideos(videos => [...videos, newVideo])
                        }
                    }

                    // Add local stream to the peer connection
                    if (window.localStream) {
                        connections[socketListId].addStream(window.localStream)
                    }
                })
            })
        })
    }

    // Create an audio track of silence
    let silence = () => {
        let ctx = new AudioContext()
        let oscillator = ctx.createOscillator()
        let dst = oscillator.connect(ctx.createMediaStreamDestination())
        oscillator.start()
        ctx.resume()
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false })
    }

    // Create a black video track
    let black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height })
        canvas.getContext('2d').fillRect(0, 0, width, height)
        let stream = canvas.captureStream()
        return Object.assign(stream.getVideoTracks()[0], { enabled: false })
    }

    // Toggle video on/off
    let handleVideo = () => {
        setVideo(!video)
    }

    // Toggle audio on/off
    let handleAudio = () => {
        setAudio(!audio)
    }

    // Toggle screen sharing
    useEffect(() => {
        if (screen !== undefined) {
            getDislayMedia()
        }
    }, [screen])

    let handleScreen = () => {
        setScreen(!screen)
    }

    // End the call
    let handleEndCall = () => {
        try {
            let tracks = localVideoref.current.srcObject.getTracks()
            tracks.forEach(track => track.stop())
        } catch (e) { }
        window.location.href = "/"
    }

    let openChat = () => {
        setModal(true);  // Opens the chat modal by setting 'showModal' to true
        setNewMessages(0);  // Resets the unread message counter to zero
    }

    let closeChat = () => {
        setModal(false);  // Closes the chat modal by setting 'showModal' to false
    }

    let handleMessage = (e) => {
        setMessage(e.target.value);  // Updates 'message' state with user input from the text field
    }


    const addMessage = (data, sender, socketIdSender) => {
        setMessages((prevMessages) => [
            ...prevMessages,  // Preserves existing messages
            { sender: sender, data: data }  // Appends new message (sender + data)
        ]);

        // Increment new message counter if message is from another user
        if (socketIdSender !== socketIdRef.current) {
            setNewMessages((prevNewMessages) => prevNewMessages + 1);
        }
    };
    // Purpose:
    // Adds incoming messages to the chat display.
    // If the sender's socket ID doesn't match the current user's, increment the unread message count.



    let sendMessage = () => {
        console.log(socketRef.current);  // Debug: Logs current socket reference
        socketRef.current.emit('chat-message', message, username)  // Sends message to server with username
        setMessage("");  // Clears the message input after sending
    }
    //Purpose: Sends messages via socket.io and clears the input field after submission.


    let connect = () => {
        setAskForUsername(false);  // Hides the username prompt after connecting
        getMedia();  // Calls function to access media (camera/microphone)
    }
    //Purpose: Connects user to the session and initializes video/audio streaming.



    return (
        <div>
            {askForUsername === true ? (
                <div>
                    <h2>Enter into Lobby</h2>
                    <TextField
                        id="outlined-basic"
                        label="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        variant="outlined"
                    />
                    <Button variant="contained" onClick={connect}>Connect</Button>
    
                    <div>
                        <video ref={localVideoref} autoPlay muted></video>
                    </div>
                </div>
            ) : (
                // Displays a username input field if the user hasn't joined yet.
                // The video element previews the local video feed after connection.
    
                <div className={styles.meetVideoContainer}>
                    {/* Chat modal */}
                    {showModal ? (
                        <div className={styles.chatRoom}>
                            <div className={styles.chatContainer}>
                                <h1>Chat</h1>
    
                                <div className={styles.chattingDisplay}>
                                    {messages.length !== 0 ? messages.map((item, index) => (
                                        <div style={{ marginBottom: "20px" }} key={index}>
                                            <p style={{ fontWeight: "bold" }}>{item.sender}</p>
                                            <p>{item.data}</p>
                                        </div>
                                    )) : (
                                        <p>No Messages Yet</p>
                                    )}
                                </div>
    
                                <div className={styles.chattingArea}>
                                    <TextField
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        id="outlined-basic"
                                        label="Enter Your chat"
                                        variant="outlined"
                                    />
                                    <Button variant="contained" onClick={sendMessage}>Send</Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <></>
                    )}
                    
                    {/* Controls */}
                    <div className={styles.buttonContainers}>
                        <IconButton onClick={handleVideo} style={{ color: "white" }}>
                            {video === true ? <VideocamIcon /> : <VideocamOffIcon />}
                        </IconButton>
                        <IconButton onClick={handleEndCall} style={{ color: "red" }}>
                            <CallEndIcon />
                        </IconButton>
                        <IconButton onClick={handleAudio} style={{ color: "white" }}>
                            {audio === true ? <MicIcon /> : <MicOffIcon />}
                        </IconButton>
    
                        {screenAvailable === true ? (
                            <IconButton onClick={handleScreen} style={{ color: "white" }}>
                                {screen === true ? <ScreenShareIcon /> : <StopScreenShareIcon />}
                            </IconButton>
                        ) : (
                            <></>
                        )}
    
                        <Badge badgeContent={newMessages} max={999} color="orange">
                            <IconButton onClick={() => setModal(!showModal)} style={{ color: "white" }}>
                                <ChatIcon />
                            </IconButton>
                        </Badge>
                    </div>
    
                    {/* Main video feed */}
                    <video
                        className={styles.mainVideo} // Applied the mainVideo class
                        ref={localVideoref}
                        autoPlay
                        muted
                    ></video>
    
                    {/* Connected users' video streams */}
                    <div className={styles.conferenceView}>
                        {videos.map((video) => (
                            <div key={video.socketId}>
                                <video
                                    data-socket={video.socketId}
                                    ref={(ref) => {
                                        if (ref && video.stream) {
                                            ref.srcObject = video.stream;
                                        }
                                    }}
                                    autoPlay
                                ></video>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
    
}