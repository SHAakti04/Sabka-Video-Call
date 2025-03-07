import axios from "axios"; 
// Importing Axios, a library for making HTTP requests.

import httpStatus from "http-status"; 
// Importing the 'http-status' library to use HTTP status codes as constants.

import { createContext, useContext, useState } from "react"; 
// Importing React hooks and functions: createContext to create a context, 
// useContext to consume context, and useState to manage state.

import { useNavigate } from "react-router-dom"; 
// Importing useNavigate from React Router to programmatically navigate between routes.

import server from "../environment"; 
// Importing a server configuration or base URL from the 'environment' file.

export const AuthContext = createContext({}); 
// Creating an empty context for authentication data.

const client = axios.create({
    baseURL: `${server}/api/v1/users`
});
// Creating an Axios client instance with a base URL for all API requests.

export const AuthProvider = ({ children }) => { 
    // Creating an authentication context provider to wrap child components.

    const authContext = useContext(AuthContext); 
    // Accessing the current value of AuthContext (if any).

    const [userData, setUserData] = useState(authContext); 
    // Initializing state for user data, defaulting to the context value.

    const router = useNavigate(); 
    // Getting the router function to navigate programmatically.

    const handleRegister = async (name, username, password) => { 
        // Function to handle user registration.
        try {
            let request = await client.post("/register", { 
                // Sending a POST request to the "/register" endpoint with user details.
                name: name,
                username: username,
                password: password
            });

            if (request.status === httpStatus.CREATED) { 
                // Checking if the response status is '201 Created'.
                return request.data.message; 
                // Returning the success message from the server response.
            }
        } catch (err) {
            throw err; 
            // Throwing the error for further handling.
        }
    };

    const handleLogin = async (username, password) => { 
        // Function to handle user login.
        try {
            let request = await client.post("/login", { 
                // Sending a POST request to the "/login" endpoint with user credentials.
                username: username,
                password: password
            });

            console.log(username, password); 
            // Logging the username and password to the console (for debugging).

            console.log(request.data); 
            // Logging the server response to the console (for debugging).

            if (request.status === httpStatus.OK) { 
                // Checking if the response status is '200 OK'.
                localStorage.setItem("token", request.data.token); 
                // Storing the received authentication token in local storage.

                router("/home"); 
                // Redirecting the user to the "/home" route.
            }
        } catch (err) {
            throw err; 
            // Throwing the error for further handling.
        }
    };

    const getHistoryOfUser = async () => { 
        // Function to fetch the user's activity history.
        try {
            let request = await client.get("/get_all_activity", { 
                // Sending a GET request to the "/get_all_activity" endpoint.
                params: {
                    token: localStorage.getItem("token") 
                    // Including the token from local storage as a parameter.
                }
            });
            return request.data; 
            // Returning the fetched data from the server.
        } catch (err) {
            throw err; 
            // Throwing the error for further handling.
        }
    };

    const addToUserHistory = async (meetingCode) => { 
        // Function to add a meeting to the user's activity history.
        try {
            let request = await client.post("/add_to_activity", { 
                // Sending a POST request to the "/add_to_activity" endpoint.
                token: localStorage.getItem("token"), 
                // Including the token from local storage in the request body.
                meeting_code: meetingCode 
                // Adding the meeting code to the request body.
            });
            return request; 
            // Returning the server response.
        } catch (e) {
            throw e; 
            // Throwing the error for further handling.
        }
    };

    const data = { 
        // Defining the data to be shared through the AuthContext.
        userData, 
        // The state containing user data.
        setUserData, 
        // The function to update user data state.
        addToUserHistory, 
        // The function to add activity to the user's history.
        getHistoryOfUser, 
        // The function to fetch the user's activity history.
        handleRegister, 
        // The function to handle user registration.
        handleLogin 
        // The function to handle user login.
    };

    return (
        <AuthContext.Provider value={data}> 
            {/* Wrapping children components in the AuthContext provider, passing the data */}
            {children}
        </AuthContext.Provider>
    );
};
