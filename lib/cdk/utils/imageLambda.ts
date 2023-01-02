import { AssetHashType, CfnOutput, Duration, Stack } from 'aws-cdk-lib'
import { Code, Function, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda'
import { Bucket } from 'aws-cdk-lib/aws-s3'

export interface SetupImageLambdaProps {
	codePath: string
	handler: string
	assetsBucket: Bucket
	layerPath: string
	lambdaHash: string
}

export const setupImageLambda = (scope: Stack, { assetsBucket, codePath, handler, layerPath, lambdaHash }: SetupImageLambdaProps) => {
	const depsLayer = new LayerVersion(scope, 'ImageOptimizationLayer', {
		code: Code.fromAsset(layerPath, {
			assetHash: lambdaHash + '_layer',
			assetHashType: AssetHashType.CUSTOM,
		}),
	})

	const imageLambda = new Function(scope, 'ImageOptimizationNextJs', {
		code: Code.fromAsset(codePath, {
			assetHash: lambdaHash + '_code',
			assetHashType: AssetHashType.CUSTOM,
		}),
		// @NOTE: Make sure to keep python3.8 as binaries seems to be messed for other versions.
		runtime: Runtime.PYTHON_3_8,
		handler: handler,
		memorySize: 256,
		timeout: Duration.seconds(10),
		layers: [depsLayer],
		environment: {
			S3_BUCKET_NAME: assetsBucket.bucketName,
		},
	})

	assetsBucket.grantRead(imageLambda)

	new CfnOutput(scope, 'imageLambdaArn', { value: imageLambda.functionArn })

	return imageLambda
}
