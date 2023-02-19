import { executeAsyncCmd } from '../utils'

interface Props {
	stackName: string
	appPath: string
	region?: string
	profile?: string
}

const cdkExecutable = require.resolve('aws-cdk/bin/cdk')

export const removeHandler = async ({ appPath, stackName, region, profile }: Props) => {
	const cdkRemoveArgs = [`--app "node ${appPath}"`, '--force', '--require-approval never', '--ci']

	if (profile) {
		cdkRemoveArgs.push(`--profile ${profile}`)
	}

	const variables = {
		STACK_NAME: stackName,
		...(region && { AWS_REGION: region }),
	}

	await executeAsyncCmd({
		cmd: `${cdkExecutable} destroy ${cdkRemoveArgs.join(' ')}`,
		env: variables,
	})
}
