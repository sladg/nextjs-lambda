import { CfnOutput, Duration, Stack } from 'aws-cdk-lib'
import { Code, Function, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda'

export interface SetupServerLambdaProps {
	codePath: string
	dependenciesPath: string
	handler: string
	basePath: string
	memory: number
	timeout: number
}

export const setupServerLambda = (scope: Stack, { basePath, codePath, dependenciesPath, handler, memory, timeout }: SetupServerLambdaProps) => {
	const depsLayer = new LayerVersion(scope, 'DepsLayer', {
		// This folder does not use Custom hash as depenendencies are most likely changing every time we deploy.
		code: Code.fromAsset(dependenciesPath),
	})

	const serverLambda = new Function(scope, 'DefaultNextJs', {
		code: Code.fromAsset(codePath),
		runtime: Runtime.NODEJS_16_X,
		handler,
		layers: [depsLayer],
		// No need for big memory as image handling is done elsewhere.
		memorySize: memory,
		timeout: Duration.seconds(timeout),
		environment: {
			// Set env vars based on what's available in environment.
			...Object.entries(process.env)
				.filter(([key]) => key.startsWith('NEXT_'))
				.reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
			NEXTJS_LAMBDA_BASE_PATH: basePath,
		},
	})

	new CfnOutput(scope, 'serverLambdaArn', { value: serverLambda.functionArn })

	return serverLambda
}
