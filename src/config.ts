import * as fs from "fs/promises";
import prompt = require("prompt");
import { encryptString as encrypt } from "./encrypt";
import { decryptString as decrypt } from "./decrypt";
import { Buffer } from "buffer";

export class Account extends Object {
  /**
   * @field The name of the owner of the account.
   */
  public Name: string;
  /**
   * @field The account secret.
   */
  private Secret: string;
  /**
   * @field If the dialog should close after opening.
   */
  public CloseAfterOpening = true;
  /**
   * @param {string} name the name associated with the account.
   * @param {boolean} closeAfterOpening close the window after opening on this account.
   */
  public constructor(name: string, closeAfterOpening: boolean) {
    super();
    this.Name = name;
    this.CloseAfterOpening = closeAfterOpening;
  }

  /**
   * @param {string} secret the TOTP secret for this account.
   * @returns {Promise<boolean>} promise of the password
   */
  public async setSecret(secret: string): Promise<boolean> {
    if (secret.startsWith("aes-")) {
      this.Secret = secret;
      return true;
    }

    const passwordPrompt: prompt.Schema = {
      properties: {
        password: {
          name: "password",
          message: "Password to encrypt with",
          type: "string",
          hidden: true,
          required: true,
          // TODO: Wait until replace attribute gets added..
          // replace: '*',
          conform(value: string) {
            return value !== "";
          }
        }
      }
    };

    const result: prompt.Properties = await prompt.get(passwordPrompt);

    if (result.password) {
      this.Secret = `aes-${encrypt(secret, result.password.toString())}`;
    } else {
      return false;
    }

    return true;
  }

  /**
   * @returns {Promise<string>} The secret after prompt otherwise undefined.
   */
  public async getSecret(pass: string | null = null, hash = false): Promise<string> {
    if (this.Secret.startsWith("aes-")) {
      if (pass !== null) {
        return decrypt(this.Secret, pass, hash);
      }

      const passwordPrompt: prompt.Schema = {
        properties: {
          password: {
            name: "password",
            message: "Password to decrypt with",
            type: "string",
            hidden: true,
            required: true,
            // TODO: Wait until replace attribute gets added..
            // replace: '*',
            conform(value) {
              return value !== "";
            }
          }
        }
      };

      const result: prompt.Properties = await prompt.get(passwordPrompt);
      return decrypt(this.Secret, result.password.toString());
    }

    return undefined;
  }

  /**
   * @returns {object} returns non stringified JSON object
   */
  public toJSON(): object {
    return {
      Name: this.Name,
      Secret: this.Secret,
      CloseAfterOpening: this.CloseAfterOpening,
    };
  }

  /**
   * @param {object} object The loaded json object.
   * @returns {Account} The account created.
   */
  public static fromObject(object: Account): Account {
    const account: Account = new Account(object.Name, object.CloseAfterOpening);
    account.setSecret(object.Secret);
    return account;
  }
}

export class Config extends Object {
  /**
   * @field The array of accounts.
   */
  private Accounts: Account[];
  /**
   * @field The request ip address.
   */
  public Ip = "127.0.0.1";
  /**
   * @field The request port.
   */
  public Port = "4646";
  /**
   * @param {Account} account The account to initially create.
   * @param {string} port The port to send the request for automatic login.
   * @param {string} ip The ip address to send the request to for automatic login.
   */
  public constructor(port: string, ip: string) {
    super();
    this.Accounts = [];
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
  public addNewAccount(account: Account) {
    if (this.Accounts.some((_account: Account) => _account.Name === account.Name) === false) {
      this.Accounts.push(account);
    } else {
      console.error(`Cannot create account with name '${account.Name}' as it already exists.`);
    }
  }

  /**
   * @param {string} name The account get via name or index.
   * @param {boolean} nozero If your passed index starts at one.
   * @returns {Account} The account gotten from the name.
   */
  public getAccount(name: string, nozero = false): Account {
    if (Number.isInteger(Number.parseInt(name, 10))) {
      if (nozero === true) {
        return this.Accounts[Number.parseInt(name, 10) - 1];
      }

      return this.Accounts[Number.parseInt(name, 10)];
    }

    return this.Accounts.find((account: Account) => account.Name === name);
  }

  /**
   * @returns {number} Number of accounts added.
   */
  public getNumberOfAccounts(): number {
    return this.Accounts.length;
  }

  /**
   *  @returns {string} stringified JSON file.
   */
  public toJSON(): string {
    const _accounts = [];

    for (const index in this.Accounts) {
      if (Object.prototype.hasOwnProperty.call(this.Accounts, index)) {
        _accounts.push(this.Accounts[index].toJSON());
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
  public static fromJSON(jsonFile: string): Config {
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
}

/**
 * @param {string} path The path to the config file.
 * @returns {Promise<Config>} the loaded config class.
 */
async function decryptConfig(path: string): Promise<Config> {
  const file: Buffer = await fs.readFile(path);
  return Config.fromJSON(file.toString());
}

const settingsPrompt: object[] = [
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

const accountPromptDefaults: prompt.Schema = {
  properties: {
    name: {
      description: "Account Name",
      name: "name",
      type: "string",
      pattern: /^[a-zA-Z\s-]+$/,
      message: "Name must be only letters, spaces, or dashes",
      hidden: false,
      default: "Default",
      required: true,
    },
    totpsecret: {
      description: "TOTP Secret",
      name: "totpsecret",
      type: "string",
      message: "Must supply a TOTP secret",
      // TODO: Wait until replace attribute gets added..
      // replace: '*',
      hidden: true,
      required: true,
      conform(value) {
        return value !== "";
      }
    },
    closeonsend: {
      description: "Close on send (y/n)",
      name: "closeonsend",
      type: "string",
      pattern: /^[yYnN]$/,
      message: "Must supply a y or an n. (yes/no)",
      hidden: false,
      default: "y",
      required: true,
    }
  }
};

/**
 * @param {string} path The path to the config file.
 * @returns {Promise<Config>} the loaded config class.
 */
export async function createNewConfig(path: string): Promise<Config> {
  const settings: prompt.Properties = await prompt.get(settingsPrompt);
  const accountPrompt = await prompt.get(accountPromptDefaults);
  const config = new Config("4646", settings.ip.toString());
  const account = new Account(accountPrompt.name.toString(), /^[yY]$/.test(accountPrompt.closeonsend.toString()));
  const secretSet = await account.setSecret(accountPrompt.totpsecret.toString());
  if (!secretSet) {
    return undefined;
  }

  config.addNewAccount(account);
  await fs.writeFile(path, config.toJSON(), { encoding: "utf8", flag: "w+" });
  return config;
}

export default { decryptConfig, createNewConfig };
