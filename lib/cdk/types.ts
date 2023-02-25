import { StackProps } from 'aws-cdk-lib'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import { IHostedZone } from 'aws-cdk-lib/aws-route53'

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
	domainNames: string[]
	redirectFromApex: boolean
	awsProfile?: string
	customApiDomain?: string
}

export interface MappedDomain {
	recordName: string
	domain: string
	zone: IHostedZone
}
