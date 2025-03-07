// Importing the 'Server' class from the 'socket.io' package to handle WebSocket connections.
import { Server } from "socket.io"

// Objects to store connections, messages, and online time for users.
let connections = {}   // Keeps track of the connections for each room.
let messages = {}      // Stores the messages for each room.
let timeOnline = {}    // Records the time when each user connects.

// This function initializes the socket server with given HTTP server and configurations.
export const connectToSocket = (server) => {
    // Create a new instance of the Socket.io server.
    const io = new Server(server, {
        cors: {
            origin: "*",                  // Allow all origins to connect.
            methods: ["GET", "POST"],      // Allowed HTTP methods for the connection.
            allowedHeaders: ["*"],         // Allow all headers for the connection.
            credentials: true              // Allow credentials (cookies) to be sent.
        }
    });

    // Setting up the "connection" event that is triggered when a new socket client connects.
    io.on("connection", (socket) => {
        console.log("SOMETHING CONNECTED")  // Log when a client connects.

        // Listening for the "join-call" event where a user joins a room (path).
        socket.on("join-call", (path) => {
            // Check if the room (path) already exists; if not, create a new empty array for connections.
            if (connections[path] === undefined) {
                connections[path] = []
            }
            // Add the current socket ID to the list of users in the room.
            connections[path].push(socket.id)

            // Record the connection time of the user.
            timeOnline[socket.id] = new Date();

            // Notify all users in the room about the new user joining.
            for (let a = 0; a < connections[path].length; a++) {
                io.to(connections[path][a]).emit("user-joined", socket.id, connections[path])
            }

            // If there are any previous messages in the room, send them to the newly joined user.
            if (messages[path] !== undefined) {
                for (let a = 0; a < messages[path].length; ++a) {
                    io.to(socket.id).emit("chat-message", messages[path][a]['data'],
                        messages[path][a]['sender'], messages[path][a]['socket-id-sender'])
                }
            }
        })

        // Listening for "signal" event to send signaling data between users.
        socket.on("signal", (toId, message) => {
            io.to(toId).emit("signal", socket.id, message);  // Send the signal to the recipient.
        })

        // Listening for "chat-message" event, where users send chat messages in a room.
        socket.on("chat-message", (data, sender) => {
            // Find the room that the sender belongs to.
            const [matchingRoom, found] = Object.entries(connections)
                .reduce(([room, isFound], [roomKey, roomValue]) => {
                    if (!isFound && roomValue.includes(socket.id)) {
                        return [roomKey, true];  // Return the room where the user is present.
                    }
                    return [room, isFound];
                }, ['', false]);

            if (found === true) {
                // If messages for the room are not initialized, create an empty array for them.
                if (messages[matchingRoom] === undefined) {
                    messages[matchingRoom] = []
                }

                // Store the new message in the messages object for the corresponding room.
                messages[matchingRoom].push({ 'sender': sender, "data": data, "socket-id-sender": socket.id })
                console.log("message", matchingRoom, ":", sender, data)

                // Send the chat message to all connected users in the room.
                connections[matchingRoom].forEach((elem) => {
                    io.to(elem).emit("chat-message", data, sender, socket.id)
                })
            }
        })

        // Listening for when a user disconnects from the socket.
        socket.on("disconnect", () => {
            // Calculate the difference in time between when the user connected and disconnected.
            var diffTime = Math.abs(timeOnline[socket.id] - new Date())

            var key  // The key (room) where the user was connected.

            // Loop through all connections and find which room the user was in.
            for (const [k, v] of JSON.parse(JSON.stringify(Object.entries(connections)))) {
                for (let a = 0; a < v.length; ++a) {
                    if (v[a] === socket.id) {
                        key = k  // Save the room key.

                        // Notify all other users in the room that this user has left.
                        for (let a = 0; a < connections[key].length; ++a) {
                            io.to(connections[key][a]).emit('user-left', socket.id)
                        }

                        // Remove the user from the connections array of the room.
                        var index = connections[key].indexOf(socket.id)
                        connections[key].splice(index, 1)

                        // If no users are left in the room, delete the room.
                        if (connections[key].length === 0) {
                            delete connections[key]
                        }
                    }
                }
            }
        })
    })

    // Return the Socket.io server instance.
    return io;
}
