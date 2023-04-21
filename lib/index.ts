import { setupApiGateway, SetupApiGwProps } from './cdk/utils/apiGw'
import { setupCfnCertificate, SetupCfnCertificateProps } from './cdk/utils/cfnCertificate'
import { setupCfnDistro, SetupCfnDistroProps } from './cdk/utils/cfnDistro'
import { PrepareDomainProps, prepareDomains, setupDnsRecords, SetupDnsRecordsProps } from './cdk/utils/dnsRecords'
import { setupImageLambda, SetupImageLambdaProps } from './cdk/utils/imageLambda'
import { setupAssetsBucket, UploadAssetsProps, uploadStaticAssets } from './cdk/utils/s3'
import { setupServerLambda, SetupServerLambdaProps } from './cdk/utils/serverLambda'

export { NextStandaloneStack } from './cdk/stack'
export { CustomStackProps } from './cdk/types'
export { handler as serverHandler } from './server-handler'

export const CdkUtils = {
	setupApiGateway,
	setupAssetsBucket,
	setupCfnCertificate,
	setupCfnDistro,
	setupDnsRecords,
	setupImageLambda,
	setupServerLambda,
	uploadStaticAssets,
	prepareDomains,
}

export {
	PrepareDomainProps,
	SetupApiGwProps,
	SetupCfnCertificateProps,
	SetupCfnDistroProps,
	SetupDnsRecordsProps,
	SetupImageLambdaProps,
	SetupServerLambdaProps,
	UploadAssetsProps,
}
