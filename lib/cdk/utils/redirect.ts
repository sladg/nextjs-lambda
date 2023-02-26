import { CfnOutput, Stack } from 'aws-cdk-lib'
import { HttpsRedirect } from 'aws-cdk-lib/aws-route53-patterns'
import { MappedDomain } from '../types'

export interface SetupApexRedirectProps {
	domain: MappedDomain
}

export const setupApexRedirect = (scope: Stack, { domain }: SetupApexRedirectProps) => {
	new HttpsRedirect(scope, `ApexRedirect`, {
		// Currently supports only apex (root) domain.
		zone: domain.zone,
		targetDomain: domain.domain,
	})

	new CfnOutput(scope, 'RedirectFrom', { value: domain.zone.zoneName })
}
