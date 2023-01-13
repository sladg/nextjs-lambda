import { executeAsyncCmd } from '../utils'

interface Props {
	stackName: string
	appPath: string
	bootstrap: boolean
	region: string
	lambdaMemory?: number
	lambdaTimeout?: number
	imageLambdaMemory?: number
	imageLambdaTimeout?: number
	customApiDomain?: string
	hostedZone?: string
	domainNamePrefix?: string
}

const cdkExecutable = require.resolve('aws-cdk/bin/cdk')

export const deployHandler = async ({
	stackName,
	appPath,
	bootstrap,
	region,
	lambdaMemory,
	lambdaTimeout,
	imageLambdaMemory,
	imageLambdaTimeout,
	domainNamePrefix,
	hostedZone,
	customApiDomain,
}: Props) => {
	// All paths are absolute.
	const cdkApp = `node ${appPath}`
	const cdkCiFlags = `--require-approval never --ci`

	const variables = {
		STACK_NAME: stackName,
		...(region && { AWS_REGION: region }),
		...(lambdaMemory && { LAMBDA_MEMORY: lambdaMemory.toString() }),
		...(lambdaTimeout && { LAMBDA_TIMEOUT: lambdaTimeout.toString() }),
		...(imageLambdaMemory && { IMAGE_LAMBDA_MEMORY: imageLambdaMemory.toString() }),
		...(imageLambdaTimeout && { IMAGE_LAMBDA_TIMEOUT: imageLambdaTimeout.toString() }),
		...(hostedZone && { HOSTED_ZONE: hostedZone }),
		...(domainNamePrefix && { DNS_PREFIX: domainNamePrefix }),
		...(customApiDomain && { CUSTOM_API_DOMAIN: customApiDomain }),
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
