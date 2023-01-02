import { CfnOutput, Stack } from 'aws-cdk-lib'
import { IDistribution } from 'aws-cdk-lib/aws-cloudfront'
import { AaaaRecord, ARecord, IHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53'
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets'

export interface SetupDnsRecordsProps {
	dnsPrefix?: string
	hostedZone: IHostedZone
	cfnDistro: IDistribution
}

export const setupDnsRecords = (scope: Stack, { dnsPrefix: recordName, hostedZone: zone, cfnDistro }: SetupDnsRecordsProps) => {
	const target = RecordTarget.fromAlias(new CloudFrontTarget(cfnDistro))

	const dnsARecord = new ARecord(scope, 'AAliasRecord', { recordName, target, zone })
	const dnsAaaaRecord = new AaaaRecord(scope, 'AaaaAliasRecord', { recordName, target, zone })

	new CfnOutput(scope, 'dns_A_Record', { value: dnsARecord.domainName })
	new CfnOutput(scope, 'dns_AAAA_Record', { value: dnsAaaaRecord.domainName })
}
