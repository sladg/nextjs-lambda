import { executeAsyncCmd } from '../utils'

interface Props {
	stackName: string
	tsconfigPath: string
	appPath: string
}

const cdkExecutable = require.resolve('aws-cdk/bin/cdk')

export const deployHandler = async ({ stackName, tsconfigPath, appPath }: Props) => {
	// All paths are absolute.
	const cdkApp = `node -r ts-node/register --project ${tsconfigPath} ${appPath}`
	const cdkCiFlags = `--require-approval never --ci`

	await executeAsyncCmd({
		cmd: `STACK_NAME=${stackName} ${cdkExecutable} deploy --app "${cdkApp}" ${cdkCiFlags}`,
	})
}
