import * as aws_cdk_lib from 'aws-cdk-lib';
import { StackProps, Stack, App } from 'aws-cdk-lib';
import * as aws_cdk_lib_aws_lambda from 'aws-cdk-lib/aws-lambda';
import { Runtime, Function } from 'aws-cdk-lib/aws-lambda';
import { IHostedZone } from 'aws-cdk-lib/aws-route53';
import * as aws_cdk_lib_aws_cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { IOrigin, IDistribution } from 'aws-cdk-lib/aws-cloudfront';
import * as aws_cdk_lib_aws_certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import * as aws_cdk_lib_aws_s3 from 'aws-cdk-lib/aws-s3';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import * as _aws_cdk_aws_apigatewayv2_alpha from '@aws-cdk/aws-apigatewayv2-alpha';
import { HttpApi } from '@aws-cdk/aws-apigatewayv2-alpha';

interface CustomStackProps extends StackProps {
    apigwServerPath: string;
    apigwImagePath: string;
    assetsZipPath: string;
    codeZipPath: string;
    dependenciesZipPath: string;
    imageHandlerZipPath: string;
    imageLayerZipPath: string;
    imageLambdaHash: string;
    customServerHandler: string;
    customImageHandler: string;
    lambdaTimeout: number;
    lambdaMemory: number;
    lambdaRuntime: Runtime;
    imageLambdaTimeout?: number;
    imageLambdaMemory?: number;
    redirectFromApex: boolean;
    customApiDomain?: string;
    certificateArn?: string;
    domainNames: string[];
    awsProfile?: string;
}
interface MappedDomain {
    recordName?: string;
    domain: string;
    zone: IHostedZone;
}

interface SetupApiGwProps {
    imageLambda: Function;
    serverLambda: Function;
    imageBasePath: string;
    serverBasePath: string;
}

interface SetupCfnCertificateProps {
    domains: MappedDomain[];
}

interface SetupCfnDistroProps {
    domains: MappedDomain[];
    certificate?: ICertificate;
    apiGateway: HttpApi;
    imageBasePath: string;
    serverBasePath: string;
    assetsBucket: Bucket;
    customApiOrigin?: IOrigin;
}

interface PrepareDomainProps {
    domains: string[];
    profile?: string;
}
interface SetupDnsRecordsProps {
    domains: MappedDomain[];
    cfnDistro: IDistribution;
}

interface SetupImageLambdaProps {
    codePath: string;
    handler: string;
    assetsBucket: Bucket;
    layerPath: string;
    lambdaHash: string;
    memory?: number;
    timeout?: number;
}

interface UploadAssetsProps {
    assetsBucket: Bucket;
    assetsPath: string;
    cfnDistribution: IDistribution;
}

interface SetupServerLambdaProps {
    codePath: string;
    dependenciesPath: string;
    handler: string;
    basePath: string;
    memory: number;
    timeout: number;
    runtime: Runtime;
}

interface SetupApexRedirectProps {
    domain: MappedDomain;
}

declare class NextStandaloneStack extends Stack {
    imageLambda?: Function;
    serverLambda?: Function;
    apiGateway?: HttpApi;
    assetsBucket?: Bucket;
    cfnDistro?: IDistribution;
    cfnCertificate?: ICertificate;
    domains: MappedDomain[];
    constructor(scope: App, id: string, config: CustomStackProps);
    prepareDomains(props: PrepareDomainProps): MappedDomain[];
    setupAssetsBucket(): Bucket;
    setupApiGateway(props: SetupApiGwProps): HttpApi;
    setupServerLambda(props: SetupServerLambdaProps): Function;
    setupImageLambda(props: SetupImageLambdaProps): Function;
    setupCfnDistro(props: SetupCfnDistroProps): aws_cdk_lib_aws_cloudfront.Distribution;
    setupCfnCertificate(props: SetupCfnCertificateProps): aws_cdk_lib_aws_certificatemanager.DnsValidatedCertificate;
    setupDnsRecords(props: SetupDnsRecordsProps): void;
    setupApexRedirect(props: SetupApexRedirectProps): void;
    uploadStaticAssets(props: UploadAssetsProps): void;
}

type Handler = (event: Object, context: Object) => Promise<Object>;
declare const handler: Handler;

declare const CdkUtils: {
    setupApiGateway: (scope: aws_cdk_lib.Stack, { imageLambda, imageBasePath, serverLambda, serverBasePath }: SetupApiGwProps) => _aws_cdk_aws_apigatewayv2_alpha.HttpApi;
    setupAssetsBucket: (scope: aws_cdk_lib.Stack) => aws_cdk_lib_aws_s3.Bucket;
    setupCfnCertificate: (scope: aws_cdk_lib.Stack, { domains }: SetupCfnCertificateProps) => aws_cdk_lib_aws_certificatemanager.DnsValidatedCertificate;
    setupCfnDistro: (scope: aws_cdk_lib.Stack, { apiGateway, imageBasePath, serverBasePath, assetsBucket, domains, certificate, customApiOrigin }: SetupCfnDistroProps) => aws_cdk_lib_aws_cloudfront.Distribution;
    setupDnsRecords: (scope: aws_cdk_lib.Stack, { domains, cfnDistro }: SetupDnsRecordsProps) => void;
    setupImageLambda: (scope: aws_cdk_lib.Stack, { assetsBucket, codePath, handler, layerPath, lambdaHash, memory, timeout }: SetupImageLambdaProps) => aws_cdk_lib_aws_lambda.Function;
    setupServerLambda: (scope: aws_cdk_lib.Stack, { basePath, codePath, dependenciesPath, handler, memory, timeout, runtime }: SetupServerLambdaProps) => aws_cdk_lib_aws_lambda.Function;
    uploadStaticAssets: (scope: aws_cdk_lib.Stack, { assetsBucket, assetsPath, cfnDistribution }: UploadAssetsProps) => void;
    prepareDomains: (scope: aws_cdk_lib.Stack, { domains, profile }: PrepareDomainProps) => MappedDomain[];
};

export { CdkUtils, CustomStackProps, NextStandaloneStack, PrepareDomainProps, SetupApiGwProps, SetupCfnCertificateProps, SetupCfnDistroProps, SetupDnsRecordsProps, SetupImageLambdaProps, SetupServerLambdaProps, UploadAssetsProps, handler as serverHandler };
