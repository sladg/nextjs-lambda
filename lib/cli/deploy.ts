import { executeAsyncCmd } from '../utils'

interface Props {
	stackName: string
	appPath: string
	bootstrap: boolean
	lambdaMemory?: number
	lambdaTimeout?: number
	hostedZone?: string
	domainNamePrefix?: string
}

const cdkExecutable = require.resolve('aws-cdk/bin/cdk')

export const deployHandler = async ({ stackName, appPath, bootstrap, lambdaMemory, lambdaTimeout, domainNamePrefix, hostedZone }: Props) => {
	// All paths are absolute.
	const cdkApp = `node ${appPath}`
	const cdkCiFlags = `--require-approval never --ci`

	const variables = {
		STACK_NAME: stackName,
		...(lambdaMemory && { LAMBDA_MEMORY: lambdaMemory.toString() }),
		...(lambdaTimeout && { LAMBDA_TIMEOUT: lambdaTimeout.toString() }),
		...(hostedZone && { HOSTED_ZONE: hostedZone }),
		...(domainNamePrefix && { DNS_PREFIX: domainNamePrefix }),
	}

	if (bootstrap) {
		await executeAsyncCmd({
			cmd: `${cdkExecutable} bootstrap --app "${cdkApp}"`,
			env: variables,
		})
	}

	await executeAsyncCmd({
		cmd: `${cdkExecutable} deploy --app "${cdkApp}" ${cdkCiFlags}`,
		env: variables,
	})
}
