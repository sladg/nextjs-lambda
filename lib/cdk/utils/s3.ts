import { CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib'
import { IDistribution } from 'aws-cdk-lib/aws-cloudfront'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment'

export const setupAssetsBucket = (scope: Stack) => {
	const assetsBucket = new Bucket(scope, 'NextAssetsBucket', {
		// Those settings are necessary for bucket to be removed on stack removal.
		removalPolicy: RemovalPolicy.DESTROY,
		autoDeleteObjects: true,
		publicReadAccess: false,
	})

	new CfnOutput(scope, 'assetsBucketUrl', { value: assetsBucket.bucketDomainName })
	new CfnOutput(scope, 'assetsBucketName', { value: assetsBucket.bucketName })

	return assetsBucket
}

export interface UploadAssetsProps {
	assetsBucket: Bucket
	assetsPath: string
	cfnDistribution: IDistribution
}

export const uploadStaticAssets = (scope: Stack, { assetsBucket, assetsPath, cfnDistribution }: UploadAssetsProps) => {
	// This can be handled by `aws s3 sync` but we need to ensure invalidation of Cfn after deploy.
	new BucketDeployment(scope, 'PublicFilesDeployment', {
		destinationBucket: assetsBucket,
		sources: [Source.asset(assetsPath)],
		// Invalidate all paths after deployment.
		distribution: cfnDistribution,
		distributionPaths: ['/*'],
	})
}
