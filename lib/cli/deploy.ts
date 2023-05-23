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
	domainNames?: string
	redirectFromApex?: boolean
	profile?: string
	hotswap: boolean
	buildFolder: string
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
	domainNames,
	customApiDomain,
	redirectFromApex,
	hotswap,
	profile,
	buildFolder,
}: Props) => {
	// All paths are absolute.
	const cdkBootstrapArgs = [`--app "node ${appPath}"`]
	const cdkDeployArgs = [`--app "node ${appPath}"`, '--require-approval never', '--ci']

	if (hotswap) {
		cdkDeployArgs.push(`--hotswap`)
	}

	if (profile) {
		cdkDeployArgs.push(`--profile ${profile}`)
		cdkBootstrapArgs.push(`--profile ${profile}`)
	}

	const variables = {
		STACK_NAME: stackName,
		...(region && { AWS_REGION: region }),
		...(lambdaMemory && { LAMBDA_MEMORY: lambdaMemory.toString() }),
		...(lambdaTimeout && { LAMBDA_TIMEOUT: lambdaTimeout.toString() }),
		...(lambdaRuntime && { LAMBDA_RUNTIME: lambdaRuntime.toString() }),
		...(imageLambdaMemory && { IMAGE_LAMBDA_MEMORY: imageLambdaMemory.toString() }),
		...(imageLambdaTimeout && { IMAGE_LAMBDA_TIMEOUT: imageLambdaTimeout.toString() }),
		...(domainNames && { DOMAIN_NAMES: domainNames }),
		...(customApiDomain && { CUSTOM_API_DOMAIN: customApiDomain }),
		...(redirectFromApex && { REDIRECT_FROM_APEX: redirectFromApex.toString() }),
		...(buildFolder && { BUILD_FOLDER: buildFolder }),
	}

	if (bootstrap) {
		await executeAsyncCmd({
			cmd: `${cdkExecutable} bootstrap ${cdkBootstrapArgs.join(' ')}`,
			env: variables,
		})
	}

	await executeAsyncCmd({
		cmd: `${cdkExecutable} deploy ${cdkDeployArgs.join(' ')}`,
		env: variables,
	})
}
