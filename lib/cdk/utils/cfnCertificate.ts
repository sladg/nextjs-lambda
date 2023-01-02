import { CfnOutput, Stack } from 'aws-cdk-lib'
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager'
import { IHostedZone } from 'aws-cdk-lib/aws-route53'

export interface SetupCfnCertificateProps {
	hostedZone: IHostedZone
	domainName: string
}

export const setupCfnCertificate = (scope: Stack, { hostedZone, domainName }: SetupCfnCertificateProps) => {
	// us-east-1 is needed for Cloudfront to accept certificate.
	const certificate = new DnsValidatedCertificate(scope, 'Certificate', { domainName, hostedZone, region: 'us-east-1' })

	new CfnOutput(scope, 'certificateArn', { value: certificate.certificateArn })

	return certificate
}
