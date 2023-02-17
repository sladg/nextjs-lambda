import { executeAsyncCmd } from '../utils'

interface Props {
	stackName: string
	appPath: string
	region?: string
	profile?: string
}

const cdkExecutable = require.resolve('aws-cdk/bin/cdk')

export const removeHandler = async ({ appPath, stackName, region, profile }: Props) => {
	const cdkApp = `node ${appPath}`
	const cdkCiFlags = `--force --ci` + profile ? `--profile ${profile}` : ``

	const variables = {
		STACK_NAME: stackName,
		...(region && { AWS_REGION: region }),
	}

	await executeAsyncCmd({
		cmd: `${cdkExecutable} destroy --app "${cdkApp}" ${cdkCiFlags}`,
		env: variables,
	})
}
