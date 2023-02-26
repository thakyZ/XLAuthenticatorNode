"use strict";

import * as crypto from "crypto";
import { Buffer } from "buffer";

export function encryptString(text: string, key: string): string {
  const hashedKey: Buffer = crypto.scryptSync(Buffer.from(key), Buffer.from("c291cGNhdHNvdXA=", "base64").toString("utf8"), 32);
  const IV_LENGTH = 16;// For AES, this is always 16
  const iv: Buffer = crypto.randomBytes(IV_LENGTH);
  const cipher: crypto.Cipher = crypto.createCipheriv("aes-256-cbc", Buffer.alloc(hashedKey.length, hashedKey, "hex"), iv);
  const encrypted: Buffer = Buffer.concat([cipher.update(Buffer.from(text, "utf8")), cipher.final()]);

  const ivString = iv.toString("hex");
  const encryptedString = encrypted.toString("hex");
  return `${ivString}:${encryptedString}`;
}
