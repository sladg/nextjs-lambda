import { executeAsyncCmd } from '../utils'

interface Props {
	stackName: string
	appPath: string
	bootstrap: boolean
	lambdaMemory?: number
	lambdaTimeout?: number
}

const cdkExecutable = require.resolve('aws-cdk/bin/cdk')

export const deployHandler = async ({ stackName, appPath, bootstrap, lambdaMemory, lambdaTimeout }: Props) => {
	// All paths are absolute.
	const cdkApp = `node ${appPath}`
	const cdkCiFlags = `--require-approval never --ci`
	const envConfig = [
		`STACK_NAME=${stackName}`,
		lambdaMemory ? `LAMBDA_MEMORY=${lambdaMemory}` : '',
		lambdaTimeout ? `LAMBDA_TIMEOUT=${lambdaTimeout}` : '',
	].join(' ')

	if (bootstrap) {
		await executeAsyncCmd({
			cmd: `${envConfig} ${cdkExecutable} bootstrap --app "${cdkApp}"`,
		})
	}

	await executeAsyncCmd({
		cmd: `${envConfig} ${cdkExecutable} deploy --app "${cdkApp}" ${cdkCiFlags}`,
	})
}
