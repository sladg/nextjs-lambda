import { HttpApi } from '@aws-cdk/aws-apigatewayv2-alpha'
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha'
import { AssetHashType, CfnOutput, Duration, RemovalPolicy, Stack, StackProps, SymlinkFollowMode } from 'aws-cdk-lib'
import { CloudFrontAllowedMethods, CloudFrontWebDistribution, ViewerCertificate } from 'aws-cdk-lib/aws-cloudfront'
import { Code, Function, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda'
import { Bucket, BucketAccessControl } from 'aws-cdk-lib/aws-s3'
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment'
import { Construct } from 'constructs'

import { imageHandlerZipPath, sharpLayerZipPath, nextLayerZipPath } from './consts'

interface NextConstructProps extends StackProps {
	customServerHandler?: string
	customImageHandler?: string

	cfnViewerCertificate?: ViewerCertificate

	imageHandlerZipPath?: string
	sharpLayerZipPath?: string
	nextLayerZipPath?: string
	codeZipPath: string
	dependenciesZipPath: string
	assetsZipPath: string
}

export class NextStandaloneStack extends Stack {
	private readonly cfnDistro: CloudFrontWebDistribution
	private readonly serverLambda: Function
	private readonly imageLambda: Function
	private readonly serverApigatewayProxy: HttpApi
	private readonly imageApigatewayProxy: HttpApi

	constructor(scope: Construct, id: string, props: NextConstructProps) {
		super(scope, id, props)

		const depsLayer = new LayerVersion(this, 'DepsLayer', {
			code: Code.fromAsset(props.dependenciesZipPath),
		})

		const sharpLayer = new LayerVersion(this, 'SharpLayer', {
			code: Code.fromAsset(props.sharpLayerZipPath ?? sharpLayerZipPath, { assetHash: 'static', assetHashType: AssetHashType.CUSTOM }),
		})

		const nextLayer = new LayerVersion(this, 'NextLayer', {
			code: Code.fromAsset(props.nextLayerZipPath ?? nextLayerZipPath, { assetHash: 'static-next', assetHashType: AssetHashType.CUSTOM }),
		})

		const assetsBucket = new Bucket(this, 'NextAssetsBucket', {
			publicReadAccess: true,
			autoDeleteObjects: true,
			removalPolicy: RemovalPolicy.DESTROY,
		})

		this.serverLambda = new Function(this, 'DefaultNextJs', {
			code: Code.fromAsset(props.codeZipPath, { followSymlinks: SymlinkFollowMode.NEVER }),
			runtime: Runtime.NODEJS_16_X,
			handler: props.customServerHandler ?? 'handler.handler',
			layers: [depsLayer, nextLayer],
			// No need for big memory as image handling is done elsewhere.
			memorySize: 512,
			timeout: Duration.seconds(15),
		})

		this.imageLambda = new Function(this, 'ImageOptimizationNextJs', {
			code: Code.fromAsset(props.imageHandlerZipPath ?? imageHandlerZipPath),
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
			sources: [Source.asset(props.assetsZipPath)],
			accessControl: BucketAccessControl.PUBLIC_READ,
			// Invalidate all paths after deployment.
			// distributionPaths: ['/*'],
			// distribution: this.cfnDistro,
		})

		new CfnOutput(this, 'cfnDistroUrl', { value: this.cfnDistro.distributionDomainName })
		new CfnOutput(this, 'cfnDistroId', { value: this.cfnDistro.distributionId })
		new CfnOutput(this, 'defaultApiGwUrl', { value: this.serverApigatewayProxy.apiEndpoint })
		new CfnOutput(this, 'imagesApiGwUrl', { value: this.imageApigatewayProxy.apiEndpoint })
		new CfnOutput(this, 'assetsBucketUrl', { value: assetsBucket.bucketDomainName })
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
