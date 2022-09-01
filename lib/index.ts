import packageJson from '../package.json'

export { NextStandaloneLambda } from './contruct'

export const SharpLayerZipPath = require.resolve(packageJson.name + '/sharp-layer/zip')
export const ImageHandlerZipPath = require.resolve(packageJson.name + '/image-handler/zip')
export const ServerHandlerPath = require.resolve(packageJson.name + '/server-handler/zip')
