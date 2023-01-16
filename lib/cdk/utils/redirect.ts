import { CfnOutput, Stack } from 'aws-cdk-lib'
import { IHostedZone } from 'aws-cdk-lib/aws-route53'
import { HttpsRedirect } from 'aws-cdk-lib/aws-route53-patterns'

export interface SetupApexRedirectProps {
	sourceHostedZone: IHostedZone
	targetDomain: string
}

export const setupApexRedirect = (scope: Stack, { sourceHostedZone, targetDomain }: SetupApexRedirectProps) => {
	new HttpsRedirect(scope, `ApexRedirect`, {
		// Currently supports only apex (root) domain.
		zone: sourceHostedZone,
		targetDomain,
	})

	new CfnOutput(scope, 'RedirectFrom', { value: sourceHostedZone.zoneName })
}
