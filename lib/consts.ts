import * as path from 'path'

export const sharpLayerZipPath = path.resolve(__dirname, './sharp-layer.zip')
export const imageHandlerZipPath = path.resolve(__dirname, './image-handler.zip')
export const serverHandlerZipPath = path.resolve(__dirname, './server-handler.zip')
export const cdkFolderPath = path.resolve(__dirname, '../cdk')

export const skipCiFlag = '[skip ci]'
export const nextServerConfigRegex = /(?<=conf: )(.*)(?=,)/
