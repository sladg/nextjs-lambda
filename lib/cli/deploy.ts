import { executeAsyncCmd } from '../utils'

interface Props {
	stackName: string
	appPath: string
	bootstrap: boolean
}

const cdkExecutable = require.resolve('aws-cdk/bin/cdk')

export const deployHandler = async ({ stackName, appPath, bootstrap }: Props) => {
	// All paths are absolute.
	const cdkApp = `node ${appPath}`
	const cdkCiFlags = `--require-approval never --ci`

	if (bootstrap) {
		await executeAsyncCmd({
			cmd: `STACK_NAME=${stackName} ${cdkExecutable} bootstrap --app "${cdkApp}"`,
		})
	}

	await executeAsyncCmd({
		cmd: `STACK_NAME=${stackName} ${cdkExecutable} deploy --app "${cdkApp}" ${cdkCiFlags}`,
	})
}
