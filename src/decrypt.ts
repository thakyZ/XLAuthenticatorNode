"use strict";

import * as crypto from "crypto";
import { Buffer } from "buffer";
import { options } from "./bridge";

/**
 * It takes a string, a key, and a boolean, and returns a string
 * @param {string} text - The encrypted text.
 * @param key - The key to decrypt the file with.
 * @param [hash=false] - boolean
 * @returns The decrypted string.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decryptString(text: string, key: string, hash = false): any {
  let hashedKey: Buffer;
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
  const iv: Buffer = Buffer.from(textParts[0], "hex");
  const encryptedText: Buffer = Buffer.from(textParts[1], "hex");
  const decipher: crypto.Decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.alloc(hashedKey.length, hashedKey, "hex"), iv);
  let decrypted: Buffer;
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
      console.error(new Error(`Failed to decrypt the file\n${error.stack}`));
    } else {
      console.error(new Error("Failed to decrypt the file"));
    }

    return undefined;
  }

  return decrypted.toString("utf8");
}
