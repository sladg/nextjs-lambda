#!/usr/bin/env node
import { exec as child_exec } from "child_process"
import util from "util"
import path from "path"

const exec = util.promisify(child_exec)

// @TODO: Ensure path exists.
// @TODO: Ensure.next folder exists with standalone folder inside.

const scriptDir = path.dirname(__filename)
const scriptName = path.resolve(`${scriptDir}/../../scripts/pack-nextjs.sh`)

const run = async () => {
  console.log("Starting packaging of your NextJS project!")
  await exec(`chmod +x ${scriptName} && ${scriptName}`).catch(console.error)
  console.log("Your NextJS project was succefully prepared for Lambda.")
}

run()
