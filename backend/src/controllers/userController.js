import httpStatus from "http-status";
import { User } from "../models/userModel.js";
import bcrypt from "bcrypt";
import crypto from "crypto"; // Import for the crypto module

// Login
const login = async (req, res) => {
  const { username, password } = req.body;

  // Check if fields are empty
  if (!username || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Find user by username (Corrected the typo: findOne instead of findone)
    const user = await User.findOne({ username });

    // If no user is found
    if (!user) {
      return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
    }

    // Compare the password with the hashed password stored in the database
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (isPasswordValid) {
      // Generate token
      let token = crypto.randomBytes(20).toString("hex");
      
      // Make sure that the user object is valid and save the token
      if (user) {
        user.token = token; // Assign token to the user
        await user.save(); // Save the user with the new token
        return res.status(httpStatus.OK).json({ message: "Login successfully", token });
      } else {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "User data is corrupted" });
      }
    } else {
      return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid credentials" });
    }
  } catch (e) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: `Something went wrong: ${e.message}` });
  }
};

// Sign Up
const register = async (req, res) => {
  const { name, username, password } = req.body;

  // Check if fields are empty
  if (!name || !username || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(httpStatus.FOUND).json({ message: "User already exists" });
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = new User({
      name,
      username,
      password: hashedPassword
    });

    // Save the new user to the database
    await newUser.save();
    res.status(httpStatus.CREATED).json({ message: "User Registered" });
    
  } catch (e) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: `Something went wrong: ${e.message}` });
  }
};
6
const getUserHistory = async (req, res) => {
  const { token } = req.query;

  try {
      const user = await User.findOne({ token: token });
      const meetings = await Meeting.find({ user_id: user.username })
      res.json(meetings)
  } catch (e) {
      res.json({ message: `Something went wrong ${e}` })
  }
}

const addToHistory = async (req, res) => {
  const { token, meeting_code } = req.body;

  try {
      const user = await User.findOne({ token: token });

      const newMeeting = new Meeting({
          user_id: user.username,
          meetingCode: meeting_code
      })

      await newMeeting.save();

      res.status(httpStatus.CREATED).json({ message: "Added code to history" })
  } catch (e) {
      res.json({ message: `Something went wrong ${e}` })
  }
}


export { login, register, getUserHistory, addToHistory };