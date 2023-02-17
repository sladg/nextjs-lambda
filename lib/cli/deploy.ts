import { executeAsyncCmd } from '../utils'

interface Props {
	stackName: string
	appPath: string
	bootstrap: boolean
	region?: string
	lambdaMemory?: number
	lambdaTimeout?: number
	lambdaRuntime?: string
	imageLambdaMemory?: number
	imageLambdaTimeout?: number
	customApiDomain?: string
	hostedZone?: string
	domainNamePrefix?: string
	redirectFromApex?: boolean
	profile?: string
}

const cdkExecutable = require.resolve('aws-cdk/bin/cdk')

export const deployHandler = async ({
	stackName,
	appPath,
	bootstrap,
	region,
	lambdaMemory,
	lambdaTimeout,
	lambdaRuntime,
	imageLambdaMemory,
	imageLambdaTimeout,
	domainNamePrefix,
	hostedZone,
	customApiDomain,
	redirectFromApex,
	profile,
}: Props) => {
	// All paths are absolute.
	const cdkApp = `node ${appPath}`
	const cdkCiFlags = `--require-approval never --ci --hotswap` + profile ? ` --profile ${profile}` : ``

	const variables = {
		STACK_NAME: stackName,
		...(region && { AWS_REGION: region }),
		...(lambdaMemory && { LAMBDA_MEMORY: lambdaMemory.toString() }),
		...(lambdaTimeout && { LAMBDA_TIMEOUT: lambdaTimeout.toString() }),
		...(lambdaRuntime && { LAMBDA_RUNTIME: lambdaRuntime.toString() }),
		...(imageLambdaMemory && { IMAGE_LAMBDA_MEMORY: imageLambdaMemory.toString() }),
		...(imageLambdaTimeout && { IMAGE_LAMBDA_TIMEOUT: imageLambdaTimeout.toString() }),
		...(hostedZone && { HOSTED_ZONE: hostedZone }),
		...(domainNamePrefix && { DNS_PREFIX: domainNamePrefix }),
		...(customApiDomain && { CUSTOM_API_DOMAIN: customApiDomain }),
		...(redirectFromApex && { REDIRECT_FROM_APEX: redirectFromApex.toString() }),
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
