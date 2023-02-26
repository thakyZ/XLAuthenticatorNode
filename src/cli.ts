import { existsSync, constants as fsConstants } from "fs";
import * as fs from "fs/promises";
import * as path from "path";
import * as process from "process";
import totp = require("totp-generator");
import commandLineArgs = require("command-line-args");
import * as prompt from "prompt";
import { default as axios, AxiosResponse } from "axios";
import { default as config, Config, Account } from "./config";
import { options as bridge } from "./bridge";
import { ProcessEnv } from "./interfaces/types";
import * as dotenv from "dotenv";
dotenv.config();

const optionsDefinitions: commandLineArgs.OptionDefinition[] = [
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
];

const proccessEnv: ProcessEnv = process.env;

// $ExpectType CommandLineOptions
const options: commandLineArgs.CommandLineOptions = commandLineArgs(optionsDefinitions);

async function getConfigPath(): Promise<string> {
  let outPath = "";
  if (process.platform === "win32" && proccessEnv.AppData) {
    const configFolder: string = path.join(process.env.AppData, "xlauth");
    if (existsSync(configFolder) && (await fs.stat(configFolder)).isDirectory()) {
      // eslint-disable-next-line no-bitwise
      if (fs.access(configFolder, fsConstants.F_OK | fsConstants.R_OK | fsConstants.W_OK | fsConstants.X_OK)) {
        outPath = path.join(configFolder, "config.json");
      } else {
        throw new Error(`No access to config folder at ${configFolder}`);
      }
    } else if (existsSync(configFolder) && (await fs.stat(configFolder)).isDirectory() === false) {
      try {
        await fs.unlink(configFolder);
        await fs.mkdir(configFolder);
      } catch (error) {
        throw new Error(`Found file at ${configFolder}, instead of directory, tried to delete but failed\n${error}`);
      } finally {
        outPath = path.join(configFolder, "config.json");
      }
    } else {
      try {
        await fs.mkdir(configFolder);
      } catch (error) {
        throw new Error(`Failed to make config folder at ${configFolder}\n${error}`);
      } finally {
        outPath = path.join(configFolder, "config.json");
      }
    }
  }

  return outPath;
}

let loadedConfig: Config;

async function loadConfig(): Promise<Config> {
  const configPath: string = await getConfigPath();
  if (existsSync(configPath)) {
    const result = await config.decryptConfig(configPath);
    return result;
  }

  const result = await config.createNewConfig(configPath);
  return result;
}

async function sendRequest(token: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: AxiosResponse<any, any>;
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
}

async function openChosenAccount(account: Account, password: string | null = null, hashed = false): Promise<boolean> {
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
}

const alterToDoubleDigit = input => input < 10 ? `0${input}` : input;

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
      console.log(`${alterToDoubleDigit(index + 1)}: ${loadedConfig.getAccount(index.toString()).Name}`);
    }

    console.log(" q: Quit");
    const accountPrompt: prompt.Schema = {
      properties: {
        account: {
          description: "Choose an account by name/number",
          name: "account",
          message: "Must be a valid account"
        }
      }
    };
    const accountChoice = await prompt.get(accountPrompt);

    if (/^(exit|quit|e|x|q)$/.test(accountChoice.account.toString())) {
      result = true;
    } else {
      const chosenAccount = loadedConfig.getAccount(accountChoice.account.toString(), true);
      result = await openChosenAccount(chosenAccount);
    }
  }

  return result;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function cli(_args: object): Promise<void> {
  if (options.debug) {
    console.log("!DEBUG ENABLED!");
    console.log(options);
    const configPath: string = await getConfigPath();
    console.log({ configPath });
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
}

export default { cli };
