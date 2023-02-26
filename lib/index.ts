export { handler as serverHandler } from './server-handler'

export { NextStandaloneStack } from './cdk/stack'
export { CustomStackProps } from './cdk/types'

import { SetupApiGwProps, setupApiGateway } from './cdk/utils/apiGw'
import { setupCfnCertificate, SetupCfnCertificateProps } from './cdk/utils/cfnCertificate'
import { SetupCfnDistroProps, setupCfnDistro } from './cdk/utils/cfnDistro'
import { SetupImageLambdaProps, setupImageLambda } from './cdk/utils/imageLambda'
import { SetupServerLambdaProps, setupServerLambda } from './cdk/utils/serverLambda'
import { UploadAssetsProps, setupAssetsBucket, uploadStaticAssets } from './cdk/utils/s3'
import { SetupDnsRecordsProps, setupDnsRecords, prepareDomains, PrepareDomainProps } from './cdk/utils/dnsRecords'

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
	//
	SetupApiGwProps,
	SetupCfnDistroProps,
	SetupCfnCertificateProps,
	SetupImageLambdaProps,
	SetupServerLambdaProps,
	UploadAssetsProps,
	SetupDnsRecordsProps,
	PrepareDomainProps,
}
