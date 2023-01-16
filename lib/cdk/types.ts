import { StackProps } from 'aws-cdk-lib'

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
	imageLambdaTimeout?: number
	imageLambdaMemory?: number
	hostedZone?: string
	dnsPrefix?: string
	customApiDomain?: string
	redirectFromApex?: boolean
}
