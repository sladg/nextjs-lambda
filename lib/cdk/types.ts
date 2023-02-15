import { StackProps } from 'aws-cdk-lib'
import { Runtime } from 'aws-cdk-lib/aws-lambda'

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
	lambdaRuntime: Runtime
	imageLambdaTimeout?: number
	imageLambdaMemory?: number
	hostedZone?: string
	dnsPrefix?: string
	customApiDomain?: string
	redirectFromApex?: boolean
}
