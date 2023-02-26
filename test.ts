import * as childProcess from "child_process";
import * as execa from "execa";
import { pEvent } from "p-event";
import { default as test } from "ava";

test("default", async t => {
  const subprocess = childProcess.spawn("./index.js", { stdio: "inherit" });
  t.is(await pEvent(subprocess, "close"), 0);
});

test("non-tty", async t => {
  const { stdout } = await execa("./index.js");
  t.regex(stdout, /\d+(?:\.\d+)? \w+/i);
});
