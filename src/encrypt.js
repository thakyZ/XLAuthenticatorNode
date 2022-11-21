"use strict";

const crypto = require("node:crypto");
const { Buffer } = require("node:buffer");

const encryptString = (text, key) => {
  const hashedKey = crypto.scryptSync(Buffer.from(key), Buffer.from("c291cGNhdHNvdXA=", "base64").toString("utf8"), 32);
  const IV_LENGTH = 16;// For AES, this is always 16
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(hashedKey, "hex"), iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(text, "utf8"), null), cipher.final()]);

  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
};

exports.encryptString = encryptString;
