process.env.NODE_ENV = "production"
process.chdir(__dirname)

import NextServer, { Options } from "next/dist/server/next-server"
import type { NextIncomingMessage } from "next/dist/server/request-meta"
import slsHttp from "serverless-http"
import path from "path"
import { ServerResponse } from "http"

// This will be loaded from custom config parsed via CLI.
const nextConf = require(`${process.env.NEXT_CONFIG_FILE ?? "./config.json"}`)

// Make sure commands gracefully respect termination signals (e.g. from Docker)
// Allow the graceful termination to be manually configurable
if (!process.env.NEXT_MANUAL_SIG_HANDLE) {
  process.on("SIGTERM", () => process.exit(0))
  process.on("SIGINT", () => process.exit(0))
}

const config: Options = {
  hostname: "localhost",
  port: Number(process.env.PORT) || 3000,
  dir: path.join(__dirname),
  dev: false,
  customServer: false,
  conf: nextConf,
}

const nextHandler = new NextServer(config).getRequestHandler()

const server = slsHttp(async (req: NextIncomingMessage, res: ServerResponse) => {
  await nextHandler(req, res)
  // @TODO: Add error handler.
})

export const handler = server
