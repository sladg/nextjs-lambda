#!/usr/bin/env node
import { exec as child_exec } from "child_process"
import util from "util"
import path from "path"
import packageJson from "../package.json"

const exec = util.promisify(child_exec)

const scriptDir = path.dirname(__filename)
const scriptPath = path.resolve(`${scriptDir}/../../scripts/pack-nextjs.sh`)
const handlerPath = path.resolve(`${scriptDir}/../server-handler/index.js`)

import { Command } from "commander"
const program = new Command()

program.name(packageJson.name).description(packageJson.description).version(packageJson.version)

program
  .command("pack")
  .description("Package standalone Next12 build into Lambda compatible ZIPs.")
  .option("--output", "folder where to save output", "next.out")
  .option("--publicFolder", "folder where public assets are located", "public")
  .option("--handler", "custom handler to deal with ApiGw events", handlerPath)
  .option("--grepBy", "keyword to identify configuration inside server.js", "webpack")
  .action(async (str, options) => {
    // @TODO: Ensure path exists.
    // @TODO: Ensure.next folder exists with standalone folder inside.

    // @TODO: Transform into code, move away from script.
    // Also, pass parameters and options.
    console.log("Starting packaging of your NextJS project!")

    await exec(`chmod +x ${scriptPath} && ${scriptPath}`)
      .then(({ stdout }) => console.log(stdout))
      .catch(console.error)

    console.log("Your NextJS project was succefully prepared for Lambda.")
  })

program
  .command("guess")
  .description("Get commits from last tag and guess bump version based on SemVer/Chakra keywords.")
  .action(async (str, options) => {
    // @TODO: Implement git commits parsing.
    // Use ref, docs, bugfix, fix, feature, feat, etc.
    // Also consider parsing commit body for things such as "Breaking change"
  })

program.parse()
