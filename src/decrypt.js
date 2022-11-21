"use strict";

const crypto = require("node:crypto");
const { Buffer } = require("node:buffer");
const { options } = require("./bridge.js");

const decryptString = (text, key, hash = false) => {
  let hashedKey = "";
  if (hash) {
    if (options.debug) {
      console.log("Ran hashed.");
    }

    hashedKey = Buffer.from(key, "hex");
  } else {
    if (options.debug) {
      console.log("Ran non-hashed.");
    }

    hashedKey = crypto.scryptSync(Buffer.from(key), Buffer.from("c291cGNhdHNvdXA=", "base64").toString("utf8"), 32);
    if (options.g) {
      console.log(hashedKey.toString("hex"));
    }
  }

  const textParts = text.replace(/^aes-/, "").split(":");
  const iv = Buffer.from(textParts[0], "hex");
  const encryptedText = Buffer.from(textParts[1], "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(hashedKey, "hex"), iv);
  let decrypted;
  try {
    decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
  } catch (error) {
    if (error.code === "ERR_OSSL_BAD_DECRYPT") {
      if (options.debug) {
        console.error({ message: "Wrong password", stack: error.stack });
      } else {
        console.error("Wrong password");
      }
    } else if (options.debug) {
      console.error({ message: "Failed to decrypt the file", stack: error.stack });
    } else {
      console.error("Failed to decrypt the file");
    }

    return undefined;
  }

  return decrypted.toString("utf8");
};

exports.decryptString = decryptString;
