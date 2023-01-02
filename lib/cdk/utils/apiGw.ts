import { HttpApi } from '@aws-cdk/aws-apigatewayv2-alpha'
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha'
import { CfnOutput, Stack } from 'aws-cdk-lib'
import { Function } from 'aws-cdk-lib/aws-lambda'

export interface SetupApiGwProps {
	imageLambda: Function
	serverLambda: Function
	imageBasePath: string
	serverBasePath: string
}

export const setupApiGateway = (scope: Stack, { imageLambda, imageBasePath, serverLambda, serverBasePath }: SetupApiGwProps) => {
	const apiGateway = new HttpApi(scope, 'ServerProxy')

	// We could do parameter mapping here and remove prefix from path.
	// However passing env var (basePath) is easier to use, understand and integrate to other solutions.
	apiGateway.addRoutes({ path: `${serverBasePath}/{proxy+}`, integration: new HttpLambdaIntegration('LambdaApigwIntegration', serverLambda) })
	apiGateway.addRoutes({ path: `${imageBasePath}/{proxy+}`, integration: new HttpLambdaIntegration('ImagesApigwIntegration', imageLambda) })

	new CfnOutput(scope, 'apiGwUrlServerUrl', { value: `${apiGateway.apiEndpoint}${serverBasePath}` })
	new CfnOutput(scope, 'apiGwUrlImageUrl', { value: `${apiGateway.apiEndpoint}${imageBasePath}` })

	return apiGateway
}
