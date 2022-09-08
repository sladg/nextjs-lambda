import { HttpApi } from '@aws-cdk/aws-apigatewayv2-alpha'
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha'
import { AssetHashType, CfnOutput, Duration, RemovalPolicy, Stack, SymlinkFollowMode } from 'aws-cdk-lib'
import { CloudFrontAllowedMethods, CloudFrontWebDistribution, ViewerCertificate } from 'aws-cdk-lib/aws-cloudfront'
import { Code, Function, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda'
import { Bucket, BucketAccessControl } from 'aws-cdk-lib/aws-s3'
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment'
import { Construct } from 'constructs'
import packageJson from '../package.json'

import { imageHandlerZipPath, sharpLayerZipPath, nextLayerZipPath } from './consts'
import { md5FileSync } from './utils'

interface NextConstructProps {
	// Required paths, output of pack CLI command.
	codeZipPath: string
	dependenciesZipPath: string
	assetsZipPath: string
	// Optional for additional customizations.
	customServerHandler?: string
	customImageHandler?: string
	cfnViewerCertificate?: ViewerCertificate
	imageHandlerZipPath?: string
	sharpLayerZipPath?: string
	nextLayerZipPath?: string
}

export class NextStandaloneConstruct extends Construct {
	private readonly cfnDistro: CloudFrontWebDistribution
	private readonly serverLambda: Function
	private readonly imageLambda: Function
	private readonly serverApigatewayProxy: HttpApi
	private readonly imageApigatewayProxy: HttpApi
	private readonly region: string

	constructor(scope: Construct, id: string, props: NextConstructProps) {
		super(scope, id)

		const config = {
			sharpLayerZipPath: sharpLayerZipPath,
			nextLayerZipPath: nextLayerZipPath,
			imageHandlerZipPath: imageHandlerZipPath,
			...props,
		}

		this.region = Stack.of(scope).region

		const depsLayer = new LayerVersion(this, 'DepsLayer', {
			code: Code.fromAsset(props.dependenciesZipPath, {
				assetHash: md5FileSync(props.dependenciesZipPath),
				assetHashType: AssetHashType.CUSTOM,
			}),
		})

		const sharpLayer = new LayerVersion(this, 'SharpLayer', {
			code: Code.fromAsset(config.sharpLayerZipPath, {
				assetHash: md5FileSync(config.sharpLayerZipPath),
				assetHashType: AssetHashType.CUSTOM,
			}),
		})

		const nextLayer = new LayerVersion(this, 'NextLayer', {
			code: Code.fromAsset(config.nextLayerZipPath, {
				assetHash: md5FileSync(config.nextLayerZipPath),
				assetHashType: AssetHashType.CUSTOM,
			}),
		})

		const assetsBucket = new Bucket(this, 'NextAssetsBucket', {
			// Those settings are necessary for bucket to be removed on stack removal.
			removalPolicy: RemovalPolicy.DESTROY,
			autoDeleteObjects: true,
			// @NOTE: Considering not having public ACL.
			publicReadAccess: true,
		})

		this.serverLambda = new Function(this, 'DefaultNextJs', {
			code: Code.fromAsset(config.codeZipPath, {
				followSymlinks: SymlinkFollowMode.NEVER,
				assetHash: md5FileSync(config.codeZipPath),
				assetHashType: AssetHashType.CUSTOM,
			}),
			runtime: Runtime.NODEJS_16_X,
			handler: props.customServerHandler ?? 'handler.handler',
			layers: [depsLayer, nextLayer],
			// No need for big memory as image handling is done elsewhere.
			memorySize: 512,
			timeout: Duration.seconds(15),
		})

		this.imageLambda = new Function(this, 'ImageOptimizationNextJs', {
			code: Code.fromAsset(config.imageHandlerZipPath, {
				assetHash: md5FileSync(config.imageHandlerZipPath),
				assetHashType: AssetHashType.CUSTOM,
			}),
			runtime: Runtime.NODEJS_16_X,
			handler: props.customImageHandler ?? 'index.handler',
			layers: [sharpLayer, nextLayer],
			memorySize: 1024,
			timeout: Duration.seconds(10),
			environment: {
				S3_SOURCE_BUCKET: assetsBucket.bucketName,
			},
		})

		assetsBucket.grantRead(this.imageLambda)

		this.serverApigatewayProxy = new HttpApi(this, 'NextJsLambdaProxy', {
			createDefaultStage: true,
			defaultIntegration: new HttpLambdaIntegration('LambdaApigwIntegration', this.serverLambda),
		})

		this.imageApigatewayProxy = new HttpApi(this, 'ImagesLambdaProxy', {
			createDefaultStage: true,
			defaultIntegration: new HttpLambdaIntegration('ImagesApigwIntegration', this.imageLambda),
		})

		this.cfnDistro = new CloudFrontWebDistribution(this, 'TestApigwDistro', {
			// Must be set, because cloufront would use index.html which would not match in NextJS routes.
			defaultRootObject: '',
			comment: 'ApiGwLambda Proxy for NextJS',
			viewerCertificate: props.cfnViewerCertificate,
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
						domainName: `${this.serverApigatewayProxy.apiId}.execute-api.${this.region}.amazonaws.com`,
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
						domainName: `${this.imageApigatewayProxy.apiId}.execute-api.${this.region}.amazonaws.com`,
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
					},
				},
			],
		})

		// This can be handled by `aws s3 sync` but we need to ensure invalidation of Cfn after deploy.
		new BucketDeployment(this, 'PublicFilesDeployment', {
			destinationBucket: assetsBucket,
			accessControl: BucketAccessControl.PUBLIC_READ,
			sources: [
				Source.asset(config.assetsZipPath, {
					assetHashType: AssetHashType.CUSTOM,
					assetHash: md5FileSync(config.assetsZipPath),
				}),
			],
			// Invalidate all paths after deployment.
			distribution: this.cfnDistro,
			distributionPaths: ['/*'],
		})

		new CfnOutput(this, 'cfnDistroUrl', { value: this.cfnDistro.distributionDomainName })
		new CfnOutput(this, 'cfnDistroId', { value: this.cfnDistro.distributionId })
		new CfnOutput(this, 'defaultApiGwUrl', { value: this.serverApigatewayProxy.apiEndpoint })
		new CfnOutput(this, 'imagesApiGwUrl', { value: this.imageApigatewayProxy.apiEndpoint })
		new CfnOutput(this, 'assetsBucketUrl', { value: assetsBucket.bucketDomainName })
		new CfnOutput(this, 'nextConstructRegion', { value: this.region })
	}

	get cloudfrontDistribution() {
		return this.cfnDistro
	}

	get serverFn() {
		return this.serverLambda
	}

	get imageFn() {
		return this.imageLambda
	}

	get serverApigw() {
		return this.serverApigatewayProxy
	}

	get imageApigw() {
		return this.imageApigatewayProxy
	}
}
