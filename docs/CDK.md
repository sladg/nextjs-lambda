# Quick example of using CDK

You can programatically import prepared CDK construct into your app. This is useful in case you want to modify the resources or incorporate them into your existing CDK app.

Example extending class:
```
import { HttpMethod } from '@aws-cdk/aws-apigatewayv2-alpha';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { NextStandaloneStack } from '@sladg/nextjs-lambda';
import { App, StackProps } from 'aws-cdk-lib';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';

export class MyCustomStack extends NextStandaloneStack {
	customLambda?: Function;

	constructor(scope: App, id: string, _props?: StackProps) {
		super(scope, id, {
			apigwImagePath: '',
			apigwServerPath: '',
			assetsZipPath: '',
			codeZipPath: '',
			customImageHandler: '',
			customServerHandler: '',
			dependenciesZipPath: '',
			imageHandlerZipPath: '',
			imageLambdaHash: '',
			imageLayerZipPath: '',
			lambdaMemory: 256,
			lambdaTimeout: 10,
		});

		this.serverLambda?.addAlias('prod');

		this.customLambda = new Function(this, 'CustomLambda', {
			code: Code.fromAsset('path/to/lambda'),
			handler: 'index.handler',
			runtime: Runtime.PYTHON_3_9,
		});

		this.apiGateway?.addRoutes({
			path: '/api',
			methods: [HttpMethod.GET],
			integration: new HttpLambdaIntegration('CustomIntegration', this.customLambda),
		});
	}
}
```

---

Example using functions and controling all resources:
```
import { handler, optimizerCodePath, optimizerLayerPath } from '@sladg/imaginex-lambda'
import { Stack, StackProps } from 'aws-cdk-lib'
import { CloudFrontWebDistribution } from 'aws-cdk-lib/aws-cloudfront'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { CdkUtils } from '@sladg/nextjs-lambda'

class MyOwnStack extends Stack {
	constructor(scope: Stack, id: string, props?: StackProps) {
		super(scope, id, props)

		const myBucket = new Bucket(this, 'my-bucket')

		const imageLambda = CdkUtils.setupImageLambda(this, {
			assetsBucket: myBucket,
			codePath: optimizerCodePath,
			handler,
			layerPath: optimizerLayerPath,
			lambdaHash: 'MyOwnHash',
		})

		const myDistro = new CloudFrontWebDistribution(this, 'my-distro', {
			originConfigs: [],
		})

		CdkUtils.uploadStaticAssets(this, {
			assetsBucket: myBucket,
			assetsPath: './path/to/my/assets',
			cfnDistribution: myDistro,
		})
	}
}
```