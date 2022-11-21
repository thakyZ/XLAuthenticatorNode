const childProcess = require("node:child_process");
const execa = require("execa");
const pEvent = require("p-event");
const test = require("ava");

test("default", async t => {
  const subprocess = childProcess.spawn("./index.js", { stdio: "inherit" });
  t.is(await pEvent(subprocess, "close"), 0);
});

test("non-tty", async t => {
  const { stdout } = await execa("./index.js");
  t.regex(stdout, /\d+(?:\.\d+)? \w+/i);
});
