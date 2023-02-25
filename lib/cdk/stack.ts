import { HttpApi } from '@aws-cdk/aws-apigatewayv2-alpha'
import { App, Stack } from 'aws-cdk-lib'
import { ICertificate } from 'aws-cdk-lib/aws-certificatemanager'
import { IDistribution } from 'aws-cdk-lib/aws-cloudfront'
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins'
import { Function } from 'aws-cdk-lib/aws-lambda'
import { Bucket } from 'aws-cdk-lib/aws-s3'

import { CustomStackProps, MappedDomain } from './types'
import { setupApiGateway, SetupApiGwProps } from './utils/apiGw'
import { setupCfnCertificate, SetupCfnCertificateProps } from './utils/cfnCertificate'
import { setupCfnDistro, SetupCfnDistroProps } from './utils/cfnDistro'
import { PrepareDomainProps, prepareDomains, setupDnsRecords, SetupDnsRecordsProps } from './utils/dnsRecords'
import { setupImageLambda, SetupImageLambdaProps } from './utils/imageLambda'
import { setupApexRedirect, SetupApexRedirectProps } from './utils/redirect'
import { setupAssetsBucket, UploadAssetsProps, uploadStaticAssets } from './utils/s3'
import { setupServerLambda, SetupServerLambdaProps } from './utils/serverLambda'

export class NextStandaloneStack extends Stack {
	imageLambda?: Function
	serverLambda?: Function
	apiGateway?: HttpApi
	assetsBucket?: Bucket
	cfnDistro?: IDistribution
	cfnCertificate?: ICertificate
	domains: MappedDomain[]

	constructor(scope: App, id: string, config: CustomStackProps) {
		super(scope, id, config)

		console.log("CDK's config:", config)

		if (!!config.customApiDomain && config.domainNames.length > 1) {
			throw new Error('Cannot use Apex redirect with multiple domains')
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
			runtime: config.lambdaRuntime,
		})

		this.apiGateway = this.setupApiGateway({
			imageLambda: this.imageLambda,
			serverLambda: this.serverLambda,
			imageBasePath: config.apigwImagePath,
			serverBasePath: config.apigwServerPath,
		})

		if (config.domainNames.length > 0) {
			this.domains = this.prepareDomains({
				domains: config.domainNames,
				profile: config.awsProfile,
			})
		}

		if (this.domains.length > 0) {
			this.cfnCertificate = this.setupCfnCertificate({
				domains: this.domains,
			})
		}

		this.cfnDistro = this.setupCfnDistro({
			assetsBucket: this.assetsBucket,
			apiGateway: this.apiGateway,
			imageBasePath: config.apigwImagePath,
			serverBasePath: config.apigwServerPath,
			domains: this.domains,
			certificate: this.cfnCertificate,
			customApiOrigin: config.customApiDomain ? new HttpOrigin(config.customApiDomain) : undefined,
		})

		this.uploadStaticAssets({
			assetsBucket: this.assetsBucket,
			assetsPath: config.assetsZipPath,
			cfnDistribution: this.cfnDistro,
		})

		if (this.domains.length > 0) {
			this.setupDnsRecords({
				cfnDistro: this.cfnDistro,
				domains: this.domains,
			})

			if (config.redirectFromApex) {
				this.setupApexRedirect({
					domain: this.domains[0],
				})
			}
		}
	}

	prepareDomains(props: PrepareDomainProps) {
		return prepareDomains(this, props)
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

	// Creates a redirect from apex/root domain to subdomain (typically wwww).
	setupApexRedirect(props: SetupApexRedirectProps) {
		return setupApexRedirect(this, props)
	}

	// Upload static assets, public folder, etc.
	uploadStaticAssets(props: UploadAssetsProps) {
		return uploadStaticAssets(this, props)
	}
}
