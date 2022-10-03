import { executeAsyncCmd } from '../utils'

interface Props {
	stackName: string
	tsconfigPath: string
	appPath: string
}

const cdkExecutable = require.resolve('aws-cdk/bin/cdk')

export const deployHandler = async ({ stackName, tsconfigPath, appPath }: Props) => {
	// Not using SWC as it's problematic on NPX (postinstall fails).
	// NPX so ts-node does not need to be a dependency.
	// All paths are absolute.
	const cdkApp = `npx ts-node --project ${tsconfigPath} ${appPath}`

	await executeAsyncCmd({
		cmd: `STACK_NAME=${stackName} ${cdkExecutable} deploy --app "${cdkApp}"`,
	})
}
