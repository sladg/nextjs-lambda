import path from 'path'
import packageJson from '../package.json'

import { HttpApi } from '@aws-cdk/aws-apigatewayv2-alpha'
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha'
import { App, CfnOutput, Duration, RemovalPolicy, Stack, StackProps, SymlinkFollowMode } from 'aws-cdk-lib'
import { CloudFrontAllowedMethods, CloudFrontWebDistribution, OriginAccessIdentity } from 'aws-cdk-lib/aws-cloudfront'
import { Function } from 'aws-cdk-lib/aws-lambda'
import { Code, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment'

const app = new App()

const commandCwd = process.cwd()
const cdkFolder = __dirname

class NextStandaloneStack extends Stack {
	constructor(scope: App, id: string, props?: StackProps) {
		super(scope, id, props)

		const config = {
			apigwServerPath: '/_server',
			apigwImagePath: '/_image',
			assetsZipPath: path.resolve(commandCwd, './next.out/assetsLayer.zip'),
			codeZipPath: path.resolve(commandCwd, './next.out/code.zip'),
			dependenciesZipPath: path.resolve(commandCwd, './next.out/dependenciesLayer.zip'),
			imageHandlerZipPath: path.resolve(cdkFolder, '../dist/image-handler.zip'),
			customServerHandler: 'handler.handler',
			customImageHandler: 'handler.handler',
			cfnViewerCertificate: undefined,
			...props,
		}

		const depsPrefix = `${packageJson.name}-${packageJson.version}`.replace(/[^a-zA-Z0-9-]/g, '')

		const depsLayer = new LayerVersion(this, 'DepsLayer', {
			// This folder does not use Custom hash as depenendencies are most likely changing every time we deploy.
			code: Code.fromAsset(config.dependenciesZipPath),
			description: `${depsPrefix}-deps`,
		})

		const serverLambda = new Function(this, 'DefaultNextJs', {
			code: Code.fromAsset(config.codeZipPath, {
				followSymlinks: SymlinkFollowMode.NEVER,
			}),
			runtime: Runtime.NODEJS_16_X,
			handler: config.customServerHandler,
			layers: [depsLayer],
			// No need for big memory as image handling is done elsewhere.
			memorySize: 512,
			timeout: Duration.seconds(15),
			environment: {
				// Set env vars based on what's available in environment.
				...Object.entries(process.env)
					.filter(([key]) => key.startsWith('NEXT_'))
					.reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
				NEXTJS_LAMBDA_BASE_PATH: config.apigwServerPath,
			},
		})

		const assetsBucket = new Bucket(this, 'NextAssetsBucket', {
			// Those settings are necessary for bucket to be removed on stack removal.
			removalPolicy: RemovalPolicy.DESTROY,
			autoDeleteObjects: true,
			publicReadAccess: false,
		})

		const imageLambda = new Function(this, 'ImageOptimizationNextJs', {
			code: Code.fromAsset(config.imageHandlerZipPath),
			runtime: Runtime.NODEJS_16_X,
			handler: config.customImageHandler,
			memorySize: 1024,
			timeout: Duration.seconds(10),
			environment: {
				S3_SOURCE_BUCKET: assetsBucket.bucketName,
			},
		})

		assetsBucket.grantRead(imageLambda)

		const apigatewayProxy = new HttpApi(this, 'ServerProxy')

		// We could do parameter mapping here and remove prefix from path.
		// However passing env var (basePath) is easier to use, understand and integrate to other solutions.
		apigatewayProxy.addRoutes({ path: `${config.apigwServerPath}/{proxy+}`, integration: new HttpLambdaIntegration('LambdaApigwIntegration', serverLambda) })
		apigatewayProxy.addRoutes({ path: `${config.apigwImagePath}/{proxy+}`, integration: new HttpLambdaIntegration('ImagesApigwIntegration', imageLambda) })

		const s3AssetsIdentity = new OriginAccessIdentity(this, 'OAICfnDistroS3', {
			comment: 'Allows CloudFront to access S3 bucket with assets',
		})

		assetsBucket.grantRead(s3AssetsIdentity)

		const cfnDistro = new CloudFrontWebDistribution(this, 'TestApigwDistro', {
			// Must be set, because cloufront would use index.html which would not match in NextJS routes.
			defaultRootObject: '',
			comment: 'ApiGwLambda Proxy for NextJS',
			viewerCertificate: config.cfnViewerCertificate,
			originConfigs: [
				{
					// Default behaviour, lambda handles.
					behaviors: [
						{
							allowedMethods: CloudFrontAllowedMethods.ALL,
							isDefaultBehavior: true,
							// @NOTE: Host cannot be used as ApiGw expects Cloudfront's host header.
							forwardedValues: { queryString: true, headers: ['Accept', 'User-Agent', 'Authorization'] },
						},
						{
							allowedMethods: CloudFrontAllowedMethods.GET_HEAD_OPTIONS,
							pathPattern: '_next/data/*',
						},
					],
					customOriginSource: {
						originPath: config.apigwServerPath,
						domainName: `${apigatewayProxy.apiId}.execute-api.${this.region}.amazonaws.com`,
					},
				},
				{
					// Our implementation of image optimization, we are tapping into Next's default route to avoid need for next.config.js changes.
					behaviors: [
						{
							// Should use caching based on query params.
							allowedMethods: CloudFrontAllowedMethods.GET_HEAD_OPTIONS,
							pathPattern: '_next/image*',
							forwardedValues: { queryString: true },
						},
					],
					customOriginSource: {
						originPath: config.apigwImagePath,
						domainName: `${apigatewayProxy.apiId}.execute-api.${this.region}.amazonaws.com`,
					},
				},
				{
					// Remaining next files (safe-catch) and our assets that are not imported via `next/image`
					behaviors: [
						{
							allowedMethods: CloudFrontAllowedMethods.GET_HEAD_OPTIONS,
							pathPattern: '_next/*',
						},
						{
							allowedMethods: CloudFrontAllowedMethods.GET_HEAD_OPTIONS,
							pathPattern: 'assets/*',
						},
					],
					s3OriginSource: {
						s3BucketSource: assetsBucket,
						originAccessIdentity: s3AssetsIdentity,
					},
				},
			],
		})

		// This can be handled by `aws s3 sync` but we need to ensure invalidation of Cfn after deploy.
		new BucketDeployment(this, 'PublicFilesDeployment', {
			destinationBucket: assetsBucket,
			sources: [Source.asset('./next.out/assetsLayer.zip')],
			// Invalidate all paths after deployment.
			distribution: cfnDistro,
			distributionPaths: ['/*'],
		})

		new CfnOutput(this, 'cfnDistroUrl', { value: cfnDistro.distributionDomainName })
		new CfnOutput(this, 'cfnDistroId', { value: cfnDistro.distributionId })
		new CfnOutput(this, 'apiGwUrl', { value: apigatewayProxy.apiEndpoint })
		new CfnOutput(this, 'assetsBucketUrl', { value: assetsBucket.bucketDomainName })
	}
}

if (!process.env.STACK_NAME) {
	throw new Error('Name of CDK stack was not specified!')
}

new NextStandaloneStack(app, process.env.STACK_NAME)

app.synth()
