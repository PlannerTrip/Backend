require("dotenv").config();

const express = require("express");

const User = require("../models/User.js");

const { hashPassword, comparePasswords } = require("../utils/function.js");

const router = express.Router();
