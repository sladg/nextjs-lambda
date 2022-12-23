import path from 'path'

export const serverHandlerZipPath = path.resolve(__dirname, './server-handler.zip')
export const nextServerConfigRegex = /(?<=conf: )(.*)(?=,)/
