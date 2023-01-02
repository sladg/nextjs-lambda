export { handler as serverHandler } from './server-handler'

export { NextStandaloneStack } from './cdk/stack'
export { CustomStackProps } from './cdk/types'

import { SetupApiGwProps, setupApiGateway } from './cdk/utils/apiGw'
import { SetupCfnCertificateProps, setupCfnCertificate } from './cdk/utils/cfnCertificate'
import { SetupCfnDistroProps, setupCfnDistro } from './cdk/utils/cfnDistro'
import { SetupImageLambdaProps, setupImageLambda } from './cdk/utils/imageLambda'
import { SetupServerLambdaProps, setupServerLambda } from './cdk/utils/serverLambda'
import { UploadAssetsProps, setupAssetsBucket, uploadStaticAssets } from './cdk/utils/s3'
import { SetupDnsRecordsProps, setupDnsRecords } from './cdk/utils/dnsRecords'

export const CdkUtils = {
	setupApiGateway,
	setupCfnCertificate,
	setupAssetsBucket,
	setupCfnDistro,
	setupDnsRecords,
	setupImageLambda,
	setupServerLambda,
	uploadStaticAssets,
}

export {
	SetupApiGwProps,
	SetupCfnCertificateProps,
	SetupCfnDistroProps,
	SetupImageLambdaProps,
	SetupServerLambdaProps,
	UploadAssetsProps,
	SetupDnsRecordsProps,
}
