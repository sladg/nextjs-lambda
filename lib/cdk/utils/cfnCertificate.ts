import { CfnOutput, Stack } from 'aws-cdk-lib'
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager'
import { MappedDomain } from '../types'

export interface SetupCfnCertificateProps {
	domains: MappedDomain[]
}

export const setupCfnCertificate = (scope: Stack, { domains }: SetupCfnCertificateProps) => {
	const [firstDomain, ...otherDomains] = domains

	// us-east-1 is needed for Cloudfront to accept certificate.
	// https://github.com/aws/aws-cdk/issues/8934
	const multiZoneMap = domains.reduce((acc, curr) => ({ ...acc, [curr.domain]: curr.zone }), {})

	const certificate = new Certificate(scope, 'Certificate', {
		domainName: firstDomain.domain,

		subjectAlternativeNames: otherDomains.map((a) => a.domain),
		validation: CertificateValidation.fromDnsMultiZone(multiZoneMap),
	})

	new CfnOutput(scope, 'certificateArn', { value: certificate.certificateArn })

	return certificate
}
