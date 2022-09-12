#!/usr/bin/env node
import 'source-map-support/register'

import { HttpApi } from '@aws-cdk/aws-apigatewayv2-alpha'
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha'
import { App, CfnOutput, Duration, RemovalPolicy, Stack, StackProps, SymlinkFollowMode } from 'aws-cdk-lib'
import { CloudFrontAllowedMethods, CloudFrontWebDistribution, OriginAccessIdentity } from 'aws-cdk-lib/aws-cloudfront'
import { Function } from 'aws-cdk-lib/aws-lambda'
import { Code, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment'

const app = new App()

class NextStandaloneStack extends Stack {
	constructor(scope: App, id: string, props?: StackProps) {
		super(scope, id, props)

		const config = {
			assetsZipPath: './next.out/assetsLayer.zip',
			codeZipPath: './next.out/code.zip',
			dependenciesZipPath: './next.out/dependenciesLayer.zip',
			customServerHandler: 'handler.handler',
			customImageHandler: 'index.handler',
			cfnViewerCertificate: undefined,
			sharpLayerZipPath: './dist/sharp-layer.zip',
			nextLayerZipPath: './dist/next-layer.zip',
			imageHandlerZipPath: './dist/image-handler.zip',
			...props,
		}

		const depsLayer = new LayerVersion(this, 'DepsLayer', {
			code: Code.fromAsset(config.dependenciesZipPath),
		})

		const sharpLayer = new LayerVersion(this, 'SharpLayer', {
			code: Code.fromAsset(config.sharpLayerZipPath),
		})

		const nextLayer = new LayerVersion(this, 'NextLayer', {
			code: Code.fromAsset(config.nextLayerZipPath),
		})

		const serverLambda = new Function(this, 'DefaultNextJs', {
			code: Code.fromAsset(config.codeZipPath, {
				followSymlinks: SymlinkFollowMode.NEVER,
			}),
			runtime: Runtime.NODEJS_16_X,
			handler: config.customServerHandler,
			layers: [depsLayer, nextLayer],
			// No need for big memory as image handling is done elsewhere.
			memorySize: 512,
			timeout: Duration.seconds(15),
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
			layers: [sharpLayer, nextLayer],
			memorySize: 1024,
			timeout: Duration.seconds(10),
			environment: {
				S3_SOURCE_BUCKET: assetsBucket.bucketName,
			},
		})

		assetsBucket.grantRead(imageLambda)

		const serverApigatewayProxy = new HttpApi(this, 'ServerProxy', {
			createDefaultStage: true,
			defaultIntegration: new HttpLambdaIntegration('LambdaApigwIntegration', serverLambda),
		})

		const imageApigatewayProxy = new HttpApi(this, 'ImagesProxy', {
			createDefaultStage: true,
			defaultIntegration: new HttpLambdaIntegration('ImagesApigwIntegration', imageLambda),
		})

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
							forwardedValues: { queryString: true },
						},
						{
							allowedMethods: CloudFrontAllowedMethods.ALL,
							pathPattern: '_next/data/*',
						},
					],
					customOriginSource: {
						domainName: `${serverApigatewayProxy.apiId}.execute-api.${this.region}.amazonaws.com`,
					},
				},
				{
					// Our implementation of image optimization, we are tapping into Next's default route to avoid need for next.config.js changes.
					behaviors: [
						{
							// Should use caching based on query params.
							allowedMethods: CloudFrontAllowedMethods.ALL,
							pathPattern: '_next/image*',
							forwardedValues: { queryString: true },
						},
					],
					customOriginSource: {
						domainName: `${imageApigatewayProxy.apiId}.execute-api.${this.region}.amazonaws.com`,
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
		new CfnOutput(this, 'defaultApiGwUrl', { value: serverApigatewayProxy.apiEndpoint })
		new CfnOutput(this, 'imagesApiGwUrl', { value: imageApigatewayProxy.apiEndpoint })
		new CfnOutput(this, 'assetsBucketUrl', { value: assetsBucket.bucketDomainName })
	}
}

new NextStandaloneStack(app, 'StandaloneNextjsStack-Temporary')

app.synth()
