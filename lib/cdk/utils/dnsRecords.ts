import { CfnOutput, Stack } from 'aws-cdk-lib'
import { IDistribution } from 'aws-cdk-lib/aws-cloudfront'
import { AaaaRecord, ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53'
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets'
import { execSync } from 'child_process'
import { MappedDomain } from '../types'
import { readFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

export interface PrepareDomainProps {
	domains: string[]
	profile?: string
}

export interface SetupDnsRecordsProps {
	domains: MappedDomain[]
	cfnDistro: IDistribution
}

// AWS-CDK does not have a way to retrieve the hosted zones in given account, so we need to go around.
const getAvailableHostedZones = (profile?: string): string[] => {
	const tmpDir = path.join(tmpdir(), 'hosted-zones.json')
	const profileFlag = profile ? `--profile ${profile}` : ''
	execSync(`aws route53 list-hosted-zones --output json ${profileFlag} > ${tmpDir}`)
	const output = JSON.parse(readFileSync(tmpDir, 'utf8'))
	return output.HostedZones.map((zone: any) => zone.Name)
}

const matchDomainToHostedZone = (domainToMatch: string, zones: string[]) => {
	const matchedZone = zones.reduce((acc, curr) => {
		const matchRegex = new RegExp(`(.*)${curr}$`)

		const isMatching = !!`${domainToMatch}.`.match(matchRegex)
		const isMoreSpecific = curr.split('.').length > (acc?.split('.').length ?? 0)

		if (isMatching && isMoreSpecific) {
			return curr
		} else {
			return acc
		}
	}, null as string | null)

	if (!matchedZone) {
		throw new Error(`No hosted zone found for domain: ${domainToMatch}`)
	}

	return matchedZone.replace('/.$/', '')
}

export const prepareDomains = (scope: Stack, { domains, profile }: PrepareDomainProps): MappedDomain[] => {
	const zones = getAvailableHostedZones(profile)

	return domains.map((domain, index) => {
		const hostedZone = matchDomainToHostedZone(domain, zones)
		const recordName = domain.replace(hostedZone, '')

		const zone = HostedZone.fromLookup(scope, `Zone_${index}`, { domainName: hostedZone })

		return { zone, recordName, domain }
	})
}

export const setupDnsRecords = (scope: Stack, { domains, cfnDistro }: SetupDnsRecordsProps) => {
	const target = RecordTarget.fromAlias(new CloudFrontTarget(cfnDistro))

	domains.forEach(({ recordName, zone }, index) => {
		const dnsARecord = new ARecord(scope, `AAliasRecord_${index}`, { recordName, target, zone })
		const dnsAaaaRecord = new AaaaRecord(scope, `AaaaAliasRecord_${index}`, { recordName, target, zone })

		new CfnOutput(scope, `dns_A_Record_${index}`, { value: dnsARecord.domainName })
		new CfnOutput(scope, `dns_AAAA_Record_${index}`, { value: dnsAaaaRecord.domainName })
	})
}
