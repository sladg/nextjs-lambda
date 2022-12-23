import { HttpApi } from '@aws-cdk/aws-apigatewayv2-alpha'
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha'
import { App, AssetHashType, CfnOutput, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib'
import { DnsValidatedCertificate, ICertificate } from 'aws-cdk-lib/aws-certificatemanager'
import {
	AllowedMethods,
	CacheCookieBehavior,
	CacheHeaderBehavior,
	CachePolicy,
	CacheQueryStringBehavior,
	Distribution,
	IDistribution,
	PriceClass,
	ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront'
import { HttpOrigin, S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins'
import { Code, Function, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda'
import { AaaaRecord, ARecord, HostedZone, IHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53'
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment'
import {
	CustomStackProps,
	GetCfnCertificateProps,
	SetDnsRecordsProps,
	SetupApiGwProps,
	SetupCfnDistroProps,
	SetupImageLambdaProps,
	SetupServerLambdaProps,
	UploadAssetsProps,
} from './types'

export class NextStandaloneStack extends Stack {
	private imageLambda?: Function
	private serverLambda?: Function
	private apiGateway?: HttpApi
	private assetsBucket?: Bucket
	private cfnDistro?: IDistribution
	private cfnCertificate?: ICertificate

	private hostedZone?: IHostedZone
	private domainName?: string

	constructor(scope: App, id: string, config: CustomStackProps) {
		super(scope, id, config)

		console.log("CDK's config:", config)

		if (config.hostedZone) {
			this.hostedZone = HostedZone.fromLookup(this, 'HostedZone_certificate', { domainName: config.hostedZone })
			this.domainName = config.dnsPrefix ? `${config.dnsPrefix}.${config.hostedZone}` : config.hostedZone
		}

		this.assetsBucket = this.setupAssetsBucket()

		this.imageLambda = this.setupImageLambda({
			codePath: config.imageHandlerZipPath,
			handler: config.customImageHandler,
			assetsBucket: this.assetsBucket,
			lambdaHash: config.imageLambdaHash,
			layerPath: config.imageLayerZipPath,
		})

		this.serverLambda = this.setupServerLambda({
			basePath: config.apigwServerPath,
			codePath: config.codeZipPath,
			handler: config.customServerHandler,
			dependenciesPath: config.dependenciesZipPath,
			timeout: config.lambdaTimeout,
			memory: config.lambdaMemory,
		})

		this.apiGateway = this.setupApiGateway({
			imageLambda: this.imageLambda,
			serverLambda: this.serverLambda,
			imageBasePath: config.apigwImagePath,
			serverBasePath: config.apigwServerPath,
		})

		if (!!this.hostedZone && !!this.domainName) {
			this.cfnCertificate = this.getCfnCertificate({
				hostedZone: this.hostedZone,
				domainName: this.domainName,
			})
		}

		this.cfnDistro = this.setupCfnDistro({
			assetsBucket: this.assetsBucket,
			apiGateway: this.apiGateway,
			imageBasePath: config.apigwImagePath,
			serverBasePath: config.apigwServerPath,
			domainName: config.dnsPrefix ? `${config.dnsPrefix}.${config.hostedZone}` : config.hostedZone,
			certificate: this.cfnCertificate,
		})

		this.uploadStaticAssets({
			assetsBucket: this.assetsBucket,
			assetsPath: config.assetsZipPath,
			cfnDistribution: this.cfnDistro,
		})

		if (!!this.hostedZone && !!this.domainName) {
			this.setDnsRecords({
				cfnDistro: this.cfnDistro,
				hostedZone: this.hostedZone,
				dnsPrefix: config.dnsPrefix,
			})
		}
	}

	setupAssetsBucket() {
		const assetsBucket = new Bucket(this, 'NextAssetsBucket', {
			// Those settings are necessary for bucket to be removed on stack removal.
			removalPolicy: RemovalPolicy.DESTROY,
			autoDeleteObjects: true,
			publicReadAccess: false,
		})

		new CfnOutput(this, 'assetsBucketUrl', { value: assetsBucket.bucketDomainName })
		new CfnOutput(this, 'assetsBucketName', { value: assetsBucket.bucketName })

		return assetsBucket
	}

	setupApiGateway({ imageLambda, imageBasePath, serverLambda, serverBasePath }: SetupApiGwProps) {
		const apiGateway = new HttpApi(this, 'ServerProxy')

		// We could do parameter mapping here and remove prefix from path.
		// However passing env var (basePath) is easier to use, understand and integrate to other solutions.
		apiGateway.addRoutes({ path: `${serverBasePath}/{proxy+}`, integration: new HttpLambdaIntegration('LambdaApigwIntegration', serverLambda) })
		apiGateway.addRoutes({ path: `${imageBasePath}/{proxy+}`, integration: new HttpLambdaIntegration('ImagesApigwIntegration', imageLambda) })

		new CfnOutput(this, 'apiGwUrlServerUrl', { value: `${apiGateway.apiEndpoint}${serverBasePath}` })
		new CfnOutput(this, 'apiGwUrlImageUrl', { value: `${apiGateway.apiEndpoint}${imageBasePath}` })

		return apiGateway
	}

	setupServerLambda({ basePath, codePath, dependenciesPath, handler, memory, timeout }: SetupServerLambdaProps) {
		const depsLayer = new LayerVersion(this, 'DepsLayer', {
			// This folder does not use Custom hash as depenendencies are most likely changing every time we deploy.
			code: Code.fromAsset(dependenciesPath),
		})

		const serverLambda = new Function(this, 'DefaultNextJs', {
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

		new CfnOutput(this, 'serverLambdaArn', { value: serverLambda.functionArn })

		return serverLambda
	}

	setupImageLambda({ assetsBucket, codePath, handler, layerPath, lambdaHash }: SetupImageLambdaProps) {
		const depsLayer = new LayerVersion(this, 'ImageOptimizationLayer', {
			code: Code.fromAsset(layerPath, {
				assetHash: lambdaHash + '_layer',
				assetHashType: AssetHashType.CUSTOM,
			}),
		})

		const imageLambda = new Function(this, 'ImageOptimizationNextJs', {
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

		new CfnOutput(this, 'imageLambdaArn', { value: imageLambda.functionArn })

		return imageLambda
	}

	setupCfnDistro({ apiGateway, imageBasePath, serverBasePath, assetsBucket, domainName, certificate }: SetupCfnDistroProps) {
		const apiGwDomainName = `${apiGateway.apiId}.execute-api.${this.region}.amazonaws.com`

		const serverOrigin = new HttpOrigin(apiGwDomainName, { originPath: serverBasePath })
		const imageOrigin = new HttpOrigin(apiGwDomainName, { originPath: imageBasePath })
		const assetsOrigin = new S3Origin(assetsBucket)

		const defaultOptions = {
			viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
			allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
		}

		const defaultCacheOptions = {
			headerBehavior: CacheHeaderBehavior.allowList('accept', 'accept-language', 'content-language', 'content-type', 'user-agent', 'authorization'),
			queryStringBehavior: CacheQueryStringBehavior.all(),
			cookieBehavior: CacheCookieBehavior.all(),
		}

		const imagesCachePolicy = new CachePolicy(this, 'NextImageCachePolicy', {
			queryStringBehavior: CacheQueryStringBehavior.all(),
			enableAcceptEncodingGzip: true,
			defaultTtl: Duration.days(30),
		})

		const serverCachePolicy = new CachePolicy(this, 'NextServerCachePolicy', {
			...defaultCacheOptions,
		})

		const apiCachePolicy = new CachePolicy(this, 'NextApiCachePolicy', {
			...defaultCacheOptions,
			maxTtl: Duration.seconds(0),
		})

		// Public folder persists names so we are making default TTL lower for cases when invalidation does not happen.
		const assetsCachePolicy = new CachePolicy(this, 'NextPublicCachePolicy', {
			queryStringBehavior: CacheQueryStringBehavior.all(),
			enableAcceptEncodingGzip: true,
			defaultTtl: Duration.hours(12),
		})

		// We don't use LambdaFunctionAssociation as that's meant only for Lambda@Edge.
		// Caching is optinionated to work out-of-the-box, for granular access and customization, create your own cache policies.
		const cfnDistro = new Distribution(this, 'CfnDistro', {
			defaultRootObject: '',
			enableIpv6: true,
			priceClass: PriceClass.PRICE_CLASS_100,
			domainNames: domainName ? [domainName] : undefined,
			certificate,
			defaultBehavior: {
				origin: serverOrigin,
				allowedMethods: AllowedMethods.ALLOW_ALL,
				cachePolicy: serverCachePolicy,
				viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
			},
			additionalBehaviors: {
				'/api*': {
					...defaultOptions,
					origin: serverOrigin,
					allowedMethods: AllowedMethods.ALLOW_ALL,
					cachePolicy: apiCachePolicy,
				},
				'_next/data/*': {
					...defaultOptions,
					origin: serverOrigin,
				},
				'_next/image*': {
					...defaultOptions,
					origin: imageOrigin,
					cachePolicy: imagesCachePolicy,
					compress: true,
				},
				'_next/*': {
					...defaultOptions,
					origin: assetsOrigin,
				},
				'assets/*': {
					...defaultOptions,
					origin: assetsOrigin,
					cachePolicy: assetsCachePolicy,
				},
			},
		})

		new CfnOutput(this, 'cfnDistroUrl', { value: cfnDistro.distributionDomainName })
		new CfnOutput(this, 'cfnDistroId', { value: cfnDistro.distributionId })

		return cfnDistro
	}

	// Creates a certificate for Cloudfront to use in case parameters are passed.
	getCfnCertificate({ hostedZone, domainName }: GetCfnCertificateProps) {
		// us-east-1 is needed for Cloudfront to accept certificate.
		const certificate = new DnsValidatedCertificate(this, 'Certificate', { domainName, hostedZone, region: 'us-east-1' })

		new CfnOutput(this, 'certificateArn', { value: certificate.certificateArn })

		return certificate
	}

	setDnsRecords({ dnsPrefix: recordName, hostedZone: zone, cfnDistro }: SetDnsRecordsProps) {
		const target = RecordTarget.fromAlias(new CloudFrontTarget(cfnDistro))

		const dnsARecord = new ARecord(this, 'AAliasRecord', { recordName, target, zone })
		const dnsAaaaRecord = new AaaaRecord(this, 'AaaaAliasRecord', { recordName, target, zone })

		new CfnOutput(this, 'dns_A_Record', { value: dnsARecord.domainName })
		new CfnOutput(this, 'dns_AAAA_Record', { value: dnsAaaaRecord.domainName })
	}

	// Upload static assets, public folder, etc.
	uploadStaticAssets({ assetsBucket, assetsPath, cfnDistribution }: UploadAssetsProps) {
		// This can be handled by `aws s3 sync` but we need to ensure invalidation of Cfn after deploy.
		new BucketDeployment(this, 'PublicFilesDeployment', {
			destinationBucket: assetsBucket,
			sources: [Source.asset(assetsPath)],
			// Invalidate all paths after deployment.
			distribution: cfnDistribution,
			distributionPaths: ['/*'],
		})
	}
}
