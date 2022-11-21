const process = require("node:process");
const fs = require("node:fs");
const path = require("node:path");
const totp = require("totp-generator");
const commandLineArgs = require("command-line-args");
const prompt = require("prompt");
const axios = require("axios");
const config = require("./config.js");
const { options: bridge } = require("./bridge.js");
require("dotenv").config();

const options = commandLineArgs([
  {
    name: "debug",
    alias: "d",
    type: Boolean,
    defaultValue: false,
  },
  {
    name: "account",
    alias: "a",
    type: String,
    defaultValue: "",
  },
  {
    name: "password",
    alias: "p",
    type: String,
    defaultValue: "",
  },
  {
    name: "hashed",
    alias: "h",
    type: Boolean,
    defaultValue: false,
  },
  {
    name: "getHash",
    alias: "g",
    type: Boolean,
    defaultValue: false,
  },
]);

const configPath = path.join(__dirname, "config.json");

let loadedConfig;

const loadConfig = async () => {
  if (fs.existsSync(configPath)) {
    const result = await config.decryptConfig(configPath);
    return result;
  }

  const result = await config.createNewConfig(configPath);
  return result;
};

const sendRequest = async token => {
  let result;
  try {
    result = await axios.get(`http://${loadedConfig.Ip}:4646/ffxivlauncher/${token}`);
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
      console.log("Failed! Connection Refused!");
    } else if (error.status === null || error.status === undefined) {
      console.log("Failed!");
    } else {
      console.log(`Failed But Unknown! Status: ${error.status}`);
    }

    return false;
  }

  if (result.status !== null && result.status === 200) {
    console.log("Success!");
    return true;
  }
};

const openChosenAccount = async (account, password = null, hashed = false) => {
  let secret;
  if (password !== null && hashed) {
    secret = await account.getSecret(password, hashed);
  } else if (password !== null && !hashed) {
    secret = await account.getSecret(password);
  } else {
    secret = await account.getSecret();
  }

  if (secret === undefined) {
    return false;
  }

  const token = totp(secret);
  return sendRequest(token);
};

const alterToDoubleDidget = input => input < 10 ? `0${input}` : input;

const openAccount = async (onLoad = false) => {
  let result;
  if (onLoad) {
    if (options.password !== "" && options.hashed !== false) {
      result = await openChosenAccount(loadedConfig.getAccount(options.account, true), options.password, true);
    } else if (options.password !== "" && options.hashed === false) {
      result = await openChosenAccount(loadedConfig.getAccount(options.account, true), options.password, false);
    } else {
      result = await openChosenAccount(loadedConfig.getAccount(options.account, true), null, false);
    }
  } else {
    console.log("Accounts:");
    for (let index = 0; index < loadedConfig.getNumberOfAccounts(); index++) {
      console.log(`${alterToDoubleDidget(index + 1)}: ${loadedConfig.getAccount(index).Name}`);
    }

    console.log(" q: Quit");
    const accountChoice = (await prompt.get([{ description: "Choose an account by name/number", name: "account", message: "Must be a valid account" }]));

    if (accountChoice.account.test(/^(exit|quit|e|x|q)$/)) {
      result = true;
    } else {
      const chosenAccount = loadedConfig.getAccount(accountChoice.account, true);
      result = await openChosenAccount(chosenAccount);
    }
  }

  return result;
};

exports.cli = async () => {
  if (options.debug) {
    console.log("!DEBUG ENABLED!");
    console.log(options);
    bridge.debug = true;
    bridge.g = options.getHash;
  }

  console.log("XL Launcher TOTP Client");
  loadedConfig = await loadConfig();
  let exit = false;
  exit = (options.account === "" ? await openAccount(false) : await openAccount(true));
  if (exit) {
    process.exit(0);
  } else {
    process.exit(1);
  }
};
