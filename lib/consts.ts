import packageJson from '../package.json'

export const sharpLayerZipPath = require.resolve(packageJson.name + '/sharp-layer/zip')
export const imageHandlerZipPath = require.resolve(packageJson.name + '/image-handler/zip')
export const serverHandlerZipPath = require.resolve(packageJson.name + '/server-handler/zip')
