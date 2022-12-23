import { HttpApi } from '@aws-cdk/aws-apigatewayv2-alpha'
import { StackProps } from 'aws-cdk-lib'
import { ICertificate } from 'aws-cdk-lib/aws-certificatemanager'
import { IDistribution } from 'aws-cdk-lib/aws-cloudfront'
import { Function } from 'aws-cdk-lib/aws-lambda'
import { IHostedZone } from 'aws-cdk-lib/aws-route53'
import { Bucket } from 'aws-cdk-lib/aws-s3'

export interface SetupServerLambdaProps {
	codePath: string
	dependenciesPath: string
	handler: string
	basePath: string
	memory: number
	timeout: number
}

export interface SetupImageLambdaProps {
	codePath: string
	handler: string
	assetsBucket: Bucket
	layerPath: string
	lambdaHash: string
}

export interface SetupApiGwProps {
	imageLambda: Function
	serverLambda: Function
	imageBasePath: string
	serverBasePath: string
}

export interface SetupCfnDistroProps {
	domainName?: string
	certificate?: ICertificate
	apiGateway: HttpApi
	imageBasePath: string
	serverBasePath: string
	assetsBucket: Bucket
}

export interface CustomStackProps extends StackProps {
	apigwServerPath: string
	apigwImagePath: string
	assetsZipPath: string
	codeZipPath: string
	dependenciesZipPath: string
	imageHandlerZipPath: string
	imageLayerZipPath: string
	imageLambdaHash: string
	customServerHandler: string
	customImageHandler: string
	lambdaTimeout: number
	lambdaMemory: number
	hostedZone?: string
	dnsPrefix?: string
}

export interface GetCfnCertificateProps {
	hostedZone: IHostedZone
	domainName: string
}

export interface UploadAssetsProps {
	assetsBucket: Bucket
	assetsPath: string
	cfnDistribution: IDistribution
}

export interface SetDnsRecordsProps {
	dnsPrefix?: string
	hostedZone: IHostedZone
	cfnDistro: IDistribution
}
