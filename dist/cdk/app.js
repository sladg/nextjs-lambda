"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// lib/cdk/app.ts
var import_imaginex_lambda = require("@sladg/imaginex-lambda");
var import_aws_cdk_lib10 = require("aws-cdk-lib");
var import_path2 = __toESM(require("path"));

// lib/cdk/config.ts
var import_aws_lambda3 = require("aws-cdk-lib/aws-lambda");
var import_envalid = require("envalid");

// lib/cdk/utils/imageLambda.ts
var import_aws_cdk_lib = require("aws-cdk-lib");
var import_aws_lambda = require("aws-cdk-lib/aws-lambda");
var DEFAULT_MEMORY = 512;
var DEFAULT_TIMEOUT = 10;
var setupImageLambda = (scope, { assetsBucket, codePath, handler: handler2, layerPath, lambdaHash, memory = DEFAULT_MEMORY, timeout = DEFAULT_TIMEOUT }) => {
  const depsLayer = new import_aws_lambda.LayerVersion(scope, "ImageOptimizationLayer", {
    code: import_aws_lambda.Code.fromAsset(layerPath, {
      assetHash: lambdaHash + "_layer",
      assetHashType: import_aws_cdk_lib.AssetHashType.CUSTOM
    })
  });
  const imageLambda = new import_aws_lambda.Function(scope, "ImageOptimizationNextJs", {
    code: import_aws_lambda.Code.fromAsset(codePath, {
      assetHash: lambdaHash + "_code",
      assetHashType: import_aws_cdk_lib.AssetHashType.CUSTOM
    }),
    // @NOTE: Make sure to keep python3.8 as binaries seems to be messed for other versions.
    runtime: import_aws_lambda.Runtime.PYTHON_3_8,
    handler: handler2,
    memorySize: memory,
    timeout: import_aws_cdk_lib.Duration.seconds(timeout),
    layers: [depsLayer],
    environment: {
      S3_BUCKET_NAME: assetsBucket.bucketName
    }
  });
  assetsBucket.grantRead(imageLambda);
  new import_aws_cdk_lib.CfnOutput(scope, "imageLambdaArn", { value: imageLambda.functionArn });
  return imageLambda;
};

// lib/cdk/utils/serverLambda.ts
var import_aws_cdk_lib2 = require("aws-cdk-lib");
var import_aws_lambda2 = require("aws-cdk-lib/aws-lambda");
var DEFAULT_MEMORY2 = 1024;
var DEFAULT_TIMEOUT2 = 20;
var DEFAULT_RUNTIME = import_aws_lambda2.Runtime.NODEJS_16_X;
var setupServerLambda = (scope, { basePath, codePath, dependenciesPath, handler: handler2, memory = DEFAULT_MEMORY2, timeout = DEFAULT_TIMEOUT2, runtime = DEFAULT_RUNTIME }) => {
  const depsLayer = new import_aws_lambda2.LayerVersion(scope, "DepsLayer", {
    // This folder does not use Custom hash as depenendencies are most likely changing every time we deploy.
    code: import_aws_lambda2.Code.fromAsset(dependenciesPath)
  });
  const serverLambda = new import_aws_lambda2.Function(scope, "DefaultNextJs", {
    code: import_aws_lambda2.Code.fromAsset(codePath),
    runtime,
    handler: handler2,
    layers: [depsLayer],
    // No need for big memory as image handling is done elsewhere.
    memorySize: memory,
    timeout: import_aws_cdk_lib2.Duration.seconds(timeout),
    environment: {
      // Set env vars based on what's available in environment.
      ...Object.entries(process.env).filter(([key]) => key.startsWith("NEXT_")).reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
      NEXTJS_LAMBDA_BASE_PATH: basePath
    }
  });
  new import_aws_cdk_lib2.CfnOutput(scope, "serverLambdaArn", { value: serverLambda.functionArn });
  return serverLambda;
};

// lib/cdk/config.ts
var RuntimeEnum = /* @__PURE__ */ ((RuntimeEnum2) => {
  RuntimeEnum2["NODEJS_14_X"] = "node14";
  RuntimeEnum2["NODEJS_16_X"] = "node16";
  RuntimeEnum2["NODEJS_18_X"] = "node18";
  return RuntimeEnum2;
})(RuntimeEnum || {});
var runtimeMap = {
  ["node14" /* NODEJS_14_X */]: import_aws_lambda3.Runtime.NODEJS_14_X,
  ["node16" /* NODEJS_16_X */]: import_aws_lambda3.Runtime.NODEJS_16_X,
  ["node18" /* NODEJS_18_X */]: import_aws_lambda3.Runtime.NODEJS_18_X
};
var RawEnvConfig = (0, import_envalid.cleanEnv)(process.env, {
  STACK_NAME: (0, import_envalid.str)(),
  LAMBDA_TIMEOUT: (0, import_envalid.num)({ default: DEFAULT_TIMEOUT2 }),
  LAMBDA_MEMORY: (0, import_envalid.num)({ default: DEFAULT_MEMORY2 }),
  LAMBDA_RUNTIME: (0, import_envalid.str)({ default: "node16" /* NODEJS_16_X */, choices: Object.values(RuntimeEnum) }),
  IMAGE_LAMBDA_TIMEOUT: (0, import_envalid.num)({ default: DEFAULT_TIMEOUT }),
  IMAGE_LAMBDA_MEMORY: (0, import_envalid.num)({ default: DEFAULT_MEMORY }),
  CUSTOM_API_DOMAIN: (0, import_envalid.str)({ default: void 0 }),
  REDIRECT_FROM_APEX: (0, import_envalid.bool)({ default: false }),
  DOMAIN_NAMES: (0, import_envalid.str)({ default: void 0 }),
  PROFILE: (0, import_envalid.str)({ default: void 0 })
});
var envConfig = {
  profile: RawEnvConfig.PROFILE,
  stackName: RawEnvConfig.STACK_NAME,
  lambdaMemory: RawEnvConfig.LAMBDA_MEMORY,
  lambdaTimeout: RawEnvConfig.LAMBDA_TIMEOUT,
  lambdaRuntime: runtimeMap[RawEnvConfig.LAMBDA_RUNTIME],
  imageLambdaMemory: RawEnvConfig.IMAGE_LAMBDA_MEMORY,
  imageLambdaTimeout: RawEnvConfig.IMAGE_LAMBDA_TIMEOUT,
  customApiDomain: RawEnvConfig.CUSTOM_API_DOMAIN,
  redirectFromApex: RawEnvConfig.REDIRECT_FROM_APEX,
  domainNames: RawEnvConfig.DOMAIN_NAMES ? RawEnvConfig.DOMAIN_NAMES.split(",").map((a) => a.trim()) : []
};

// lib/cdk/stack.ts
var import_aws_cdk_lib9 = require("aws-cdk-lib");
var import_aws_cloudfront_origins2 = require("aws-cdk-lib/aws-cloudfront-origins");

// lib/cdk/utils/apiGw.ts
var import_aws_apigatewayv2_alpha = require("@aws-cdk/aws-apigatewayv2-alpha");
var import_aws_apigatewayv2_integrations_alpha = require("@aws-cdk/aws-apigatewayv2-integrations-alpha");
var import_aws_cdk_lib3 = require("aws-cdk-lib");
var setupApiGateway = (scope, { imageLambda, imageBasePath, serverLambda, serverBasePath }) => {
  const apiGateway = new import_aws_apigatewayv2_alpha.HttpApi(scope, "ServerProxy");
  apiGateway.addRoutes({ path: `${serverBasePath}/{proxy+}`, integration: new import_aws_apigatewayv2_integrations_alpha.HttpLambdaIntegration("LambdaApigwIntegration", serverLambda) });
  apiGateway.addRoutes({ path: `${imageBasePath}/{proxy+}`, integration: new import_aws_apigatewayv2_integrations_alpha.HttpLambdaIntegration("ImagesApigwIntegration", imageLambda) });
  new import_aws_cdk_lib3.CfnOutput(scope, "apiGwUrlServerUrl", { value: `${apiGateway.apiEndpoint}${serverBasePath}` });
  new import_aws_cdk_lib3.CfnOutput(scope, "apiGwUrlImageUrl", { value: `${apiGateway.apiEndpoint}${imageBasePath}` });
  return apiGateway;
};

// lib/cdk/utils/cfnCertificate.ts
var import_aws_cdk_lib4 = require("aws-cdk-lib");
var import_aws_certificatemanager = require("aws-cdk-lib/aws-certificatemanager");
var setupCfnCertificate = (scope, { domains }) => {
  const [firstDomain, ...otherDomains] = domains;
  const multiZoneMap = otherDomains.reduce((acc, curr) => ({ ...acc, [curr.domain]: curr.zone }), {});
  const certificate = new import_aws_certificatemanager.DnsValidatedCertificate(scope, "Certificate", {
    domainName: firstDomain.domain,
    hostedZone: firstDomain.zone,
    subjectAlternativeNames: otherDomains.map((a) => a.domain),
    validation: import_aws_certificatemanager.CertificateValidation.fromDnsMultiZone(multiZoneMap),
    region: "us-east-1"
  });
  new import_aws_cdk_lib4.CfnOutput(scope, "certificateArn", { value: certificate.certificateArn });
  return certificate;
};

// lib/cdk/utils/cfnDistro.ts
var import_aws_cdk_lib5 = require("aws-cdk-lib");
var import_aws_cloudfront = require("aws-cdk-lib/aws-cloudfront");
var import_aws_cloudfront_origins = require("aws-cdk-lib/aws-cloudfront-origins");
var setupCfnDistro = (scope, { apiGateway, imageBasePath, serverBasePath, assetsBucket, domains, certificate, customApiOrigin }) => {
  const apiGwDomainName = `${apiGateway.apiId}.execute-api.${scope.region}.amazonaws.com`;
  const serverOrigin = new import_aws_cloudfront_origins.HttpOrigin(apiGwDomainName, { originPath: serverBasePath });
  const imageOrigin = new import_aws_cloudfront_origins.HttpOrigin(apiGwDomainName, { originPath: imageBasePath });
  const assetsOrigin = new import_aws_cloudfront_origins.S3Origin(assetsBucket);
  const defaultOptions = {
    viewerProtocolPolicy: import_aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    allowedMethods: import_aws_cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS
  };
  const defaultCacheOptions = {
    headerBehavior: import_aws_cloudfront.CacheHeaderBehavior.allowList("accept", "accept-language", "content-language", "content-type", "user-agent", "authorization"),
    queryStringBehavior: import_aws_cloudfront.CacheQueryStringBehavior.all(),
    cookieBehavior: import_aws_cloudfront.CacheCookieBehavior.all()
  };
  const imagesCachePolicy = new import_aws_cloudfront.CachePolicy(scope, "NextImageCachePolicy", {
    queryStringBehavior: import_aws_cloudfront.CacheQueryStringBehavior.all(),
    enableAcceptEncodingGzip: true,
    defaultTtl: import_aws_cdk_lib5.Duration.days(30)
  });
  const serverCachePolicy = new import_aws_cloudfront.CachePolicy(scope, "NextServerCachePolicy", {
    ...defaultCacheOptions
  });
  const apiCachePolicy = new import_aws_cloudfront.CachePolicy(scope, "NextApiCachePolicy", {
    ...defaultCacheOptions,
    maxTtl: import_aws_cdk_lib5.Duration.seconds(0),
    defaultTtl: import_aws_cdk_lib5.Duration.seconds(0),
    minTtl: import_aws_cdk_lib5.Duration.seconds(0)
  });
  const assetsCachePolicy = new import_aws_cloudfront.CachePolicy(scope, "NextPublicCachePolicy", {
    queryStringBehavior: import_aws_cloudfront.CacheQueryStringBehavior.all(),
    enableAcceptEncodingGzip: true,
    defaultTtl: import_aws_cdk_lib5.Duration.hours(12)
  });
  const cfnDistro = new import_aws_cloudfront.Distribution(scope, "CfnDistro", {
    defaultRootObject: "",
    comment: `CloudFront distribution for ${scope.stackName}`,
    enableIpv6: true,
    priceClass: import_aws_cloudfront.PriceClass.PRICE_CLASS_100,
    domainNames: domains.length > 0 ? domains.map((a) => a.domain) : void 0,
    certificate,
    defaultBehavior: {
      origin: serverOrigin,
      allowedMethods: import_aws_cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: serverCachePolicy,
      viewerProtocolPolicy: import_aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
    },
    additionalBehaviors: {
      "/api*": {
        ...defaultOptions,
        origin: customApiOrigin != null ? customApiOrigin : serverOrigin,
        allowedMethods: import_aws_cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: apiCachePolicy
      },
      "_next/data/*": {
        ...defaultOptions,
        origin: serverOrigin
      },
      "_next/image*": {
        ...defaultOptions,
        origin: imageOrigin,
        cachePolicy: imagesCachePolicy,
        compress: true
      },
      "_next/*": {
        ...defaultOptions,
        origin: assetsOrigin
      },
      "assets/*": {
        ...defaultOptions,
        origin: assetsOrigin,
        cachePolicy: assetsCachePolicy
      }
    }
  });
  new import_aws_cdk_lib5.CfnOutput(scope, "cfnDistroUrl", { value: cfnDistro.distributionDomainName });
  new import_aws_cdk_lib5.CfnOutput(scope, "cfnDistroId", { value: cfnDistro.distributionId });
  return cfnDistro;
};

// lib/cdk/utils/dnsRecords.ts
var import_aws_cdk_lib6 = require("aws-cdk-lib");
var import_aws_route53 = require("aws-cdk-lib/aws-route53");
var import_aws_route53_targets = require("aws-cdk-lib/aws-route53-targets");
var import_child_process = require("child_process");
var import_fs = require("fs");
var import_os = require("os");
var import_path = __toESM(require("path"));
var getAvailableHostedZones = (profile) => {
  const tmpDir = import_path.default.join((0, import_os.tmpdir)(), "hosted-zones.json");
  const profileFlag = profile ? `--profile ${profile}` : "";
  (0, import_child_process.execSync)(`aws route53 list-hosted-zones --output json ${profileFlag} > ${tmpDir}`);
  const output = JSON.parse((0, import_fs.readFileSync)(tmpDir, "utf8"));
  return output.HostedZones.map((zone) => zone.Name);
};
var matchDomainToHostedZone = (domainToMatch, zones) => {
  const matchedZone = zones.reduce((acc, curr) => {
    var _a2;
    const matchRegex = new RegExp(`(.*)${curr}$`);
    const isMatching = !!`${domainToMatch}.`.match(matchRegex);
    const isMoreSpecific = curr.split(".").length > ((_a2 = acc == null ? void 0 : acc.split(".").length) != null ? _a2 : 0);
    if (isMatching && isMoreSpecific) {
      return curr;
    } else {
      return acc;
    }
  }, null);
  if (!matchedZone) {
    throw new Error(`No hosted zone found for domain: ${domainToMatch}`);
  }
  return matchedZone.endsWith(".") ? matchedZone.slice(0, -1) : matchedZone;
};
var prepareDomains = (scope, { domains, profile }) => {
  const zones = getAvailableHostedZones(profile);
  return domains.map((domain, index) => {
    const hostedZone = matchDomainToHostedZone(domain, zones);
    const subdomain = domain.replace(hostedZone, "");
    const recordName = subdomain.endsWith(".") ? subdomain.slice(0, -1) : subdomain;
    const zone = import_aws_route53.HostedZone.fromLookup(scope, `Zone_${index}`, { domainName: hostedZone });
    return { zone, recordName, domain, subdomain, hostedZone };
  });
};
var setupDnsRecords = (scope, { domains, cfnDistro }) => {
  const target = import_aws_route53.RecordTarget.fromAlias(new import_aws_route53_targets.CloudFrontTarget(cfnDistro));
  domains.forEach(({ recordName, zone }, index) => {
    const dnsARecord = new import_aws_route53.ARecord(scope, `AAliasRecord_${index}`, { recordName, target, zone });
    const dnsAaaaRecord = new import_aws_route53.AaaaRecord(scope, `AaaaAliasRecord_${index}`, { recordName, target, zone });
    new import_aws_cdk_lib6.CfnOutput(scope, `dns_A_Record_${index}`, { value: dnsARecord.domainName });
    new import_aws_cdk_lib6.CfnOutput(scope, `dns_AAAA_Record_${index}`, { value: dnsAaaaRecord.domainName });
  });
};

// lib/cdk/utils/redirect.ts
var import_aws_cdk_lib7 = require("aws-cdk-lib");
var import_aws_route53_patterns = require("aws-cdk-lib/aws-route53-patterns");
var setupApexRedirect = (scope, { domain }) => {
  new import_aws_route53_patterns.HttpsRedirect(scope, `ApexRedirect`, {
    // Currently supports only apex (root) domain.
    zone: domain.zone,
    targetDomain: domain.domain
  });
  new import_aws_cdk_lib7.CfnOutput(scope, "RedirectFrom", { value: domain.zone.zoneName });
};

// lib/cdk/utils/s3.ts
var import_aws_cdk_lib8 = require("aws-cdk-lib");
var import_aws_s3 = require("aws-cdk-lib/aws-s3");
var import_aws_s3_deployment = require("aws-cdk-lib/aws-s3-deployment");
var setupAssetsBucket = (scope) => {
  const assetsBucket = new import_aws_s3.Bucket(scope, "NextAssetsBucket", {
    // Those settings are necessary for bucket to be removed on stack removal.
    removalPolicy: import_aws_cdk_lib8.RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
    publicReadAccess: false
  });
  new import_aws_cdk_lib8.CfnOutput(scope, "assetsBucketUrl", { value: assetsBucket.bucketDomainName });
  new import_aws_cdk_lib8.CfnOutput(scope, "assetsBucketName", { value: assetsBucket.bucketName });
  return assetsBucket;
};
var uploadStaticAssets = (scope, { assetsBucket, assetsPath, cfnDistribution }) => {
  new import_aws_s3_deployment.BucketDeployment(scope, "PublicFilesDeployment", {
    destinationBucket: assetsBucket,
    sources: [import_aws_s3_deployment.Source.asset(assetsPath)],
    // Invalidate all paths after deployment.
    distribution: cfnDistribution,
    distributionPaths: ["/*"]
  });
};

// lib/cdk/stack.ts
var NextStandaloneStack = class extends import_aws_cdk_lib9.Stack {
  constructor(scope, id, config) {
    super(scope, id, config);
    this.domains = [];
    console.log("CDK's config:", config);
    if (!!config.customApiDomain && config.domainNames.length > 1) {
      throw new Error("Cannot use Apex redirect with multiple domains");
    }
    this.assetsBucket = this.setupAssetsBucket();
    this.imageLambda = this.setupImageLambda({
      codePath: config.imageHandlerZipPath,
      handler: config.customImageHandler,
      assetsBucket: this.assetsBucket,
      lambdaHash: config.imageLambdaHash,
      layerPath: config.imageLayerZipPath,
      timeout: config.imageLambdaTimeout,
      memory: config.imageLambdaMemory
    });
    this.serverLambda = this.setupServerLambda({
      basePath: config.apigwServerPath,
      codePath: config.codeZipPath,
      handler: config.customServerHandler,
      dependenciesPath: config.dependenciesZipPath,
      timeout: config.lambdaTimeout,
      memory: config.lambdaMemory,
      runtime: config.lambdaRuntime
    });
    this.apiGateway = this.setupApiGateway({
      imageLambda: this.imageLambda,
      serverLambda: this.serverLambda,
      imageBasePath: config.apigwImagePath,
      serverBasePath: config.apigwServerPath
    });
    if (config.domainNames.length > 0) {
      this.domains = this.prepareDomains({
        domains: config.domainNames,
        profile: config.awsProfile
      });
      console.log("Domains's config:", this.domains);
    }
    if (this.domains.length > 0) {
      this.cfnCertificate = this.setupCfnCertificate({
        domains: this.domains
      });
    }
    this.cfnDistro = this.setupCfnDistro({
      assetsBucket: this.assetsBucket,
      apiGateway: this.apiGateway,
      imageBasePath: config.apigwImagePath,
      serverBasePath: config.apigwServerPath,
      domains: this.domains,
      certificate: this.cfnCertificate,
      customApiOrigin: config.customApiDomain ? new import_aws_cloudfront_origins2.HttpOrigin(config.customApiDomain) : void 0
    });
    this.uploadStaticAssets({
      assetsBucket: this.assetsBucket,
      assetsPath: config.assetsZipPath,
      cfnDistribution: this.cfnDistro
    });
    if (this.domains.length > 0) {
      this.setupDnsRecords({
        cfnDistro: this.cfnDistro,
        domains: this.domains
      });
      if (config.redirectFromApex) {
        this.setupApexRedirect({
          domain: this.domains[0]
        });
      }
    }
  }
  prepareDomains(props) {
    return prepareDomains(this, props);
  }
  setupAssetsBucket() {
    return setupAssetsBucket(this);
  }
  setupApiGateway(props) {
    return setupApiGateway(this, props);
  }
  setupServerLambda(props) {
    return setupServerLambda(this, props);
  }
  setupImageLambda(props) {
    return setupImageLambda(this, props);
  }
  setupCfnDistro(props) {
    return setupCfnDistro(this, props);
  }
  // Creates a certificate for Cloudfront to use in case parameters are passed.
  setupCfnCertificate(props) {
    return setupCfnCertificate(this, props);
  }
  setupDnsRecords(props) {
    return setupDnsRecords(this, props);
  }
  // Creates a redirect from apex/root domain to subdomain (typically wwww).
  setupApexRedirect(props) {
    return setupApexRedirect(this, props);
  }
  // Upload static assets, public folder, etc.
  uploadStaticAssets(props) {
    return uploadStaticAssets(this, props);
  }
};

// lib/cdk/app.ts
var app = new import_aws_cdk_lib10.App();
var commandCwd = process.cwd();
var _a;
new NextStandaloneStack(app, envConfig.stackName, {
  // NextJS lambda specific config.
  assetsZipPath: import_path2.default.resolve(commandCwd, "./dist/apps/ui-hosted-checkout-page/next.out/assetsLayer.zip"),
  codeZipPath: import_path2.default.resolve(commandCwd, "./dist/apps/ui-hosted-checkout-page/next.out/code.zip"),
  dependenciesZipPath: import_path2.default.resolve(commandCwd, "./dist/apps/ui-hosted-checkout-page/next.out/dependenciesLayer.zip"),
  customServerHandler: "index.handler",
  // Image lambda specific config.
  imageHandlerZipPath: import_imaginex_lambda.optimizerCodePath,
  imageLayerZipPath: import_imaginex_lambda.optimizerLayerPath,
  imageLambdaHash: `${import_imaginex_lambda.name}_${import_imaginex_lambda.version}`,
  customImageHandler: import_imaginex_lambda.handler,
  // Lambda & AWS config.
  apigwServerPath: "/_server",
  apigwImagePath: "/_image",
  ...envConfig,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: (_a = process.env.AWS_REGION) != null ? _a : process.env.CDK_DEFAULT_REGION
  }
});
app.synth();
