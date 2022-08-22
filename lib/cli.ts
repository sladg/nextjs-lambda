#!/usr/bin/env node
import { exec as child_exec } from "child_process"
import util from "util"

const exec = util.promisify(child_exec)

// @TODO: Ensure path exists.
// @TODO: Ensure.next folder exists with standalone folder inside.

const run = async () => {
  console.log("Starting packaging of your NextJS project!")
  await exec("chmod +x ./pack-nextjs.sh && ./pack-nextjs.sh").catch(console.error)
  console.log("Your NextJS project was succefully prepared for Lambda.")
}

run()
