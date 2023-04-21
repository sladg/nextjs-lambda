import { CfnOutput, Stack } from 'aws-cdk-lib'
import { CertificateValidation, DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager'

import { MappedDomain } from '../types'

export interface SetupCfnCertificateProps {
	domains: MappedDomain[]
}

export const setupCfnCertificate = (scope: Stack, { domains }: SetupCfnCertificateProps) => {
	const [firstDomain, ...otherDomains] = domains

	// us-east-1 is needed for Cloudfront to accept certificate.
	// https://github.com/aws/aws-cdk/issues/8934
	const multiZoneMap = otherDomains.reduce((acc, curr) => ({ ...acc, [curr.domain]: curr.zone }), {})

	const easyCheck = domains.reduce((acc, curr) => ({ ...acc, [curr.domain]: curr.zone.zoneName }), {})

	// We need to stick with DNSValidatedCertificate for now, because Certificate construct does not support region specifiation.
	// So we would need to manage two different stacks and create certificate in us-east-1 with second stack.
	const certificate = new DnsValidatedCertificate(scope, 'Certificate', {
		domainName: firstDomain.domain,
		hostedZone: firstDomain.zone,
		subjectAlternativeNames: otherDomains.map((a) => a.domain),
		validation: CertificateValidation.fromDnsMultiZone(multiZoneMap),
		region: 'us-east-1',
	})

	new CfnOutput(scope, 'certificateArn', { value: certificate.certificateArn })

	return certificate
}
