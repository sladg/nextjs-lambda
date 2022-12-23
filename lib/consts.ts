import * as path from 'path'

export const serverHandlerZipPath = path.resolve(__dirname, './server-handler.zip')
export const cdkFolderPath = path.resolve(__dirname, '../cdk')

export const skipCiFlag = '[skip ci]'
export const nextServerConfigRegex = /(?<=conf: )(.*)(?=,)/
