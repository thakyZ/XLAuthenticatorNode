const fsPromise = require("node:fs").promises;
const prompt = require("prompt");
const encrypt = require("./encrypt.js");
const decrypt = require("./decrypt.js");

const Config = class {
  /**
   * @field The array of accounts.
   */
  #Accounts;
  /**
   * @field The request ip address.
   */
  Ip = "127.0.0.1";
  /**
   * @field The request port.
   */
  Port = "4646";
  /**
   * @param {Account} account The account to initially create.
   * @param {string} port The port to send the request for automatic login.
   * @param {string} ip The ip address to send the request to for automatic login.
   */
  constructor(port, ip) {
    this.#Accounts = [];
    /* Depreciated code
    try {
      if (this.#Accounts.find(_account => _account.name === account.Name) === undefined) {
        this.#Accounts.push(account);
      } else {
        throw { message: `Cannot create account with name '${account.name}' as it already exists.` };
      }
    } catch (err) {
      throw err;
    }
    */
    this.Ip = ip;
    this.Port = port;
  }

  /**
   * @param {Account} account he account to add to the list.
   */
  addNewAccount(account) {
    if (this.#Accounts.some(_account => _account.name === account.Name) === undefined) {
      this.#Accounts.push(account);
    } else {
      console.error({ message: `Cannot create account with name '${account.Name}' as it already exists.` });
    }
  }

  /**
   * @param {string} name The account get via name or index.
   * @param {boolean} nozero If your passed index starts at one.
   * @returns {Account} The account gotten from the name.
   */
  getAccount(name, nozero = false) {
    if (Number.isInteger(Number.parseInt(name, 10))) {
      if (nozero === true) {
        return this.#Accounts[Number.parseInt(name, 10) - 1];
      }

      return this.#Accounts[Number.parseInt(name, 10)];
    }

    return this.#Accounts.find(account => account.name === name);
  }

  /**
   * @returns {int} Number of accounts added.
   */
  getNumberOfAccounts() {
    return this.#Accounts.length;
  }

  /**
   *  @returns {string} stringified JSON file.
   */
  toJSON() {
    const _accounts = [];

    for (const index in this.#Accounts) {
      if (Object.prototype.hasOwnProperty.call(this.#Accounts, index)) {
        _accounts.push(this.#Accounts[index].toJSON());
      }
    }

    return JSON.stringify({
      Accounts: _accounts,
      Ip: this.Ip,
      Port: this.Port,
    }, null, 2);
  }

  /**
   * @param {string} jsonFile The file buffer already converted to string.
   * @return {Config} the loaded config file.
   */
  static fromJSON(jsonFile) {
    const json = JSON.parse(jsonFile);
    const config = new Config(json.Port, json.Ip);

    if (json.Accounts.length > 0) {
      for (const index in json.Accounts) {
        if (Object.prototype.hasOwnProperty.call(json.Accounts, index)) {
          const account = new Account(json.Accounts[index].Name, json.Accounts[index].CloseAfterOpening);
          account.setSecret(json.Accounts[index].Secret);
          config.addNewAccount(account);
        }
      }
    }

    return config;
  }
};

const Account = class {
  Name;
  #Secret;
  CloseAfterOpening = true;
  /**
   * @param {string} name the name accociated with the account.
   * @param {string} secret the TOTP secret for this account.
   * @param {boolean} closeAfterOpening close the window after opening on this account.
   */
  constructor(name, closeAfterOpening) {
    this.Name = name;
    this.CloseAfterOpening = closeAfterOpening;
  }

  /**
   * @param {string} secret the TOTP secret for this account.
   * @returns {boolean} promise of the password
   */
  async setSecret(secret) {
    if (secret.test(/^aes-/)) {
      this.#Secret = secret;
      return true;
    }

    const result = await prompt.get([{ name: "password", message: "Password to encrypt with", replace: "*", hidden: true, required: true }]);

    if (result.password) {
      this.#Secret = `aes-${encrypt.encryptString(secret, result.password)}`;
    } else {
      return false;
    }

    return true;
  }

  /**
   * @returns {string} The secret after prompt otherwise undefined.
   */
  async getSecret(pass = null, hash = false) {
    if (this.#Secret.test(/^aes-/)) {
      if (pass !== null) {
        return decrypt.decryptString(this.#Secret, pass, hash);
      }

      pass = await prompt.get([{ name: "password", message: "Password to decrypt with", replace: "*", hidden: true, required: true }]);
      return decrypt.decryptString(this.#Secret, pass.password);
    }

    return undefined;
  }

  /**
   * @returns {object} returns non stringified JSON object
   */
  toJSON() {
    return {
      Name: this.Name,
      Secret: this.#Secret,
      CloseAfterOpening: this.CloseAfterOpening,
    };
  }

  /**
   * @param {Object} object The loaded json object.
   * @returns {Account} The account created.
   */
  static fromObject(object) {
    const account = new Account(object.Name, object.closeAfterOpening);
    account.setSecret(object.secret);
    return account;
  }
};

/**
 * @param {string} path The path to the config file.
 * @returns {Config} the loaded config class.
 */
const decryptConfig = async path => {
  const file = await fsPromise.readFile(path);
  return Config.fromJSON(file.toString());
};

const settingsPrompt = [
  {
    description: "IPv4/IPv6 address",
    name: "ip",
    type: "string",
    pattern: /^((?:(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\.){3}(?: 25[0-5]|2[0-4]\d|[01]?\d{1,2})|\b(?:[A-F\d]{1,4}:){7}[A-F\d]{1,4}\b|localhost|::1)$/,
    message: "Must be a valid ipv4/ipv6 address",
    hidden: false,
    default: "localhost",
    required: true,
  },
];

const accountPromptDefaults = [
  {
    description: "Account Name",
    name: "name",
    type: "string",
    pattern: /^[a-zA-Z\s-]+$/,
    message: "Name must be only letters, spaces, or dashes",
    hidden: false,
    default: "Default",
    required: true,
  },
  {
    description: "TOTP Secret",
    name: "totpsecret",
    type: "string",
    message: "Must supply a TOTP secret",
    replace: "*",
    hidden: true,
    required: true,
  },
  {
    description: "Close on send (y/n)",
    name: "closeonsend",
    type: "string",
    pattern: /^[yYnN]$/,
    message: "Must supply a y or an n. (yes/no)",
    hidden: false,
    default: "y",
    required: true,
  },
];

/**
 * @param {string} path The path to the config file.
 * @returns {Config} the loaded config class.
 */
const createNewConfig = async path => {
  const settings = await prompt.get(settingsPrompt);
  const accountPrompt = await prompt.get(accountPromptDefaults);
  const config = new Config("4646", settings.ip);
  const account = new Account(accountPrompt.name, accountPrompt.closeonsend.test(/^[yY]$/));
  const secretSet = await account.setSecret(accountPrompt.totpsecret);
  if (!secretSet) {
    return undefined;
  }

  config.addNewAccount(account);
  await fsPromise.writeFile(path, config.toJSON(), { encoding: "utf8", flag: "w+" });
  return config;
};

exports.Config = Config;
exports.decryptConfig = decryptConfig;
exports.createNewConfig = createNewConfig;
