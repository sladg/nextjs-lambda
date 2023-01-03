import { HttpApi } from '@aws-cdk/aws-apigatewayv2-alpha'
import { App, Stack } from 'aws-cdk-lib'
import { ICertificate } from 'aws-cdk-lib/aws-certificatemanager'
import { IDistribution } from 'aws-cdk-lib/aws-cloudfront'
import { Function } from 'aws-cdk-lib/aws-lambda'
import { HostedZone, IHostedZone } from 'aws-cdk-lib/aws-route53'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { CustomStackProps } from './types'
import { setupApiGateway, SetupApiGwProps } from './utils/apiGw'
import { setupCfnCertificate, SetupCfnCertificateProps } from './utils/cfnCertificate'
import { setupCfnDistro, SetupCfnDistroProps } from './utils/cfnDistro'
import { setupDnsRecords, SetupDnsRecordsProps } from './utils/dnsRecords'
import { setupImageLambda, SetupImageLambdaProps } from './utils/imageLambda'
import { setupAssetsBucket, UploadAssetsProps, uploadStaticAssets } from './utils/s3'
import { setupServerLambda, SetupServerLambdaProps } from './utils/serverLambda'

export class NextStandaloneStack extends Stack {
	imageLambda?: Function
	serverLambda?: Function
	apiGateway?: HttpApi
	assetsBucket?: Bucket
	cfnDistro?: IDistribution
	cfnCertificate?: ICertificate
	hostedZone?: IHostedZone
	domainName?: string

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
			timeout: config.imageLambdaTimeout,
			memory: config.imageLambdaMemory,
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
			this.cfnCertificate = this.setupCfnCertificate({
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
			this.setupDnsRecords({
				cfnDistro: this.cfnDistro,
				hostedZone: this.hostedZone,
				dnsPrefix: config.dnsPrefix,
			})
		}
	}

	setupAssetsBucket() {
		return setupAssetsBucket(this)
	}

	setupApiGateway(props: SetupApiGwProps) {
		return setupApiGateway(this, props)
	}

	setupServerLambda(props: SetupServerLambdaProps) {
		return setupServerLambda(this, props)
	}

	setupImageLambda(props: SetupImageLambdaProps) {
		return setupImageLambda(this, props)
	}

	setupCfnDistro(props: SetupCfnDistroProps) {
		return setupCfnDistro(this, props)
	}

	// Creates a certificate for Cloudfront to use in case parameters are passed.
	setupCfnCertificate(props: SetupCfnCertificateProps) {
		return setupCfnCertificate(this, props)
	}

	setupDnsRecords(props: SetupDnsRecordsProps) {
		return setupDnsRecords(this, props)
	}

	// Upload static assets, public folder, etc.
	uploadStaticAssets(props: UploadAssetsProps) {
		return uploadStaticAssets(this, props)
	}
}
