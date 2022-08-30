# NextJS Lambda Utils

This is a set of utils needed for deploying NextJS into AWS Lambda.
It includes a wrapper for `next/server/image-optimizer` allowing to use S3.
And includes CLI and custom server handler to integrate with ApiGw.

- [NextJS Lambda Utils](#nextjs-lambda-utils)
  - [Usage](#usage)
    - [next.config.js](#nextconfigjs)
    - [Server handler](#server-handler)
    - [Image handler](#image-handler)
    - [CDK](#cdk)
  - [Sharp](#sharp)
  - [Packaging](#packaging)
    - [Server handler](#server-handler-1)
    - [Static assets](#static-assets)
- [Versioning](#versioning)
  - [Guess](#guess)
  - [Shipit](#shipit)
- [TODO](#todo)
- [Disclaimer](#disclaimer)

## Usage

We need to create 2 lambdas in order to use NextJS. First one is handling pages/api rendering, second is solving image optimization.

This division makes it easier to control resources and specify sizes and timeouts as those operations are completely different.

Loading of assets and static content is handled via Cloudfront and S3 origin, so there is no need for specifying this behaviour in Lambda or handling it anyhow.

### next.config.js

The only requirement is to change your Next12 config to produce standalone output via `output: 'standalone'`.
This should work fine for single-repositories with yarn/npm/pnpm.

In case you are using monorepo/workspaces, be aware! Producing standalone build is tricky due to dependencies being spread out and not contained within single `node_modules` folder, making it complicated for `SWC` to properly produce required dependencies. This would most likely result in deployment failing with HTTP 500, internal error, as some required dependency is not in place.

See:

- https://github.com/vercel/next.js/issues/36386
- https://github.com/vercel/next.js/discussions/32223
-

### Server handler

```
next build

npx @sladg/nextjs-lambda pack
```

Create new lambda function with NODE_16 runtime in AWS.

```
const dependenciesLayer = new LayerVersion(this, 'DepsLayer', {
        code: Code.fromAsset(`next.out/dependenciesLayer.zip`),
    })

const requestHandlerFn = new Function(this, 'LambdaFunction', {
      code: Code.fromAsset(`next.out/code.zip`, { followSymlinks: SymlinkFollowMode.NEVER }),
      runtime: Runtime.NODEJS_16_X,
      handler: 'handler.handler',
      layers: [dependenciesLayer],
      memorySize: 512,
      timeout: Duration.seconds(10),
    })
```

### Image handler

Create new lambda function with NODE_16 runtime in AWS.

```
const sharpLayer: LayerVersion
const assetsBucket: Bucket

const imageHandlerZip = require.resolve('@sladg/nextjs-lambda/image-handler/zip')

const imageOptimizerFn = new Function(this, 'LambdaFunction', {
      code: Code.fromAsset(imageHandlerZip),
      runtime: Runtime.NODEJS_16_X,
      handler: 'index.handler',
      layers: [sharpLayer],
      memorySize: 1024,
      timeout: Duration.seconds(15),
      environment: {
        S3_BUCKET_SOURCE: assetsBucket.bucketName
      }
    })
```

Lambda consumes Api Gateway requests, so we need to create ApiGw proxy (v2) that will trigger Lambda.

Lambda is designed to serve `_next/image*` route in NextJS stack and replaces the default handler so we can optimize caching and memory limits for page renders and image optimization.

### CDK

Here is complete example using CDK:

```
import { HttpApi } from '@aws-cdk/aws-apigatewayv2-alpha'
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha'
import { AssetHashType, CfnOutput, Duration, RemovalPolicy, Stack, StackProps, SymlinkFollowMode } from 'aws-cdk-lib'
import { CloudFrontAllowedMethods, CloudFrontWebDistribution } from 'aws-cdk-lib/aws-cloudfront'
import { Code, Function, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda'
import { Bucket, BucketAccessControl } from 'aws-cdk-lib/aws-s3'
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment'
import { Construct } from 'constructs'

const imageHandlerZip = require.resolve('@sladg/nextjs-lambda/image-handler/zip')
const sharpLayerZip = require.resolve('@sladg/nextjs-lambda/sharp-layer/zip')

export class NextLambdaStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const depsLayer = new LayerVersion(this, 'DepsLayer', {
      code: Code.fromAsset(`next.out/dependenciesLayer.zip`),
    })

    const sharpLayer = new LayerVersion(this, 'SharpLayer', {
      code: Code.fromAsset(sharpLayerZip, { assetHash: 'static', assetHashType: AssetHashType.CUSTOM }),
    })

    const assetsBucket = new Bucket(this, 'NextAssetsBucket', {
      publicReadAccess: true,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const lambdaFn = new Function(this, 'DefaultNextJs', {
      code: Code.fromAsset(`next.out/code.zip`, { followSymlinks: SymlinkFollowMode.NEVER }),
      runtime: Runtime.NODEJS_16_X,
      handler: 'handler.handler',
      layers: [depsLayer],
      // No need for big memory as image handling is done elsewhere.
      memorySize: 512,
      timeout: Duration.seconds(15),
    })

    const imageOptimizationFn = new Function(this, 'ImageOptimizationNextJs', {
      code: Code.fromAsset(imageHandlerZip),
      runtime: Runtime.NODEJS_16_X,
      handler: 'index.handler',
      layers: [sharpLayer],
      memorySize: 1024,
      timeout: Duration.seconds(10),
      environment: {
        S3_SOURCE_BUCKET: assetsBucket.bucketName,
      },
    })

    assetsBucket.grantRead(imageOptimizationFn)

    const apiGwDefault = new HttpApi(this, 'NextJsLambdaProxy', {
      createDefaultStage: true,
      defaultIntegration: new HttpLambdaIntegration('LambdaApigwIntegration', lambdaFn),
    })

    const apiGwImages = new HttpApi(this, 'ImagesLambdaProxy', {
      createDefaultStage: true,
      defaultIntegration: new HttpLambdaIntegration('ImagesApigwIntegration', imageOptimizationFn),
    })

    const cfnDistro = new CloudFrontWebDistribution(this, 'TestApigwDistro', {
      // Must be set, because cloufront would use index.html which would not match in NextJS routes.
      defaultRootObject: '',
      comment: 'ApiGwLambda Proxy for NextJS',
      originConfigs: [
        {
          // Default behaviour, lambda handles.
          behaviors: [
            {
              allowedMethods: CloudFrontAllowedMethods.ALL,
              isDefaultBehavior: true,
              forwardedValues: { queryString: true },
            },
            {
              allowedMethods: CloudFrontAllowedMethods.ALL,
              pathPattern: '_next/data/*',
            },
          ],
          customOriginSource: {
            domainName: `${apiGwDefault.apiId}.execute-api.${this.region}.amazonaws.com`,
          },
        },
        {
          // Our implementation of image optimization, we are tapping into Next's default route to avoid need for next.config.js changes.
          behaviors: [
            {
              // Should use caching based on query params.
              allowedMethods: CloudFrontAllowedMethods.ALL,
              pathPattern: '_next/image*',
              forwardedValues: { queryString: true },
            },
          ],
          customOriginSource: {
            domainName: `${apiGwImages.apiId}.execute-api.${this.region}.amazonaws.com`,
          },
        },
        {
          // Remaining next files (safe-catch) and our assets that are not imported via `next/image`
          behaviors: [
            {
              allowedMethods: CloudFrontAllowedMethods.GET_HEAD_OPTIONS,
              pathPattern: '_next/*',
            },
            {
              allowedMethods: CloudFrontAllowedMethods.GET_HEAD_OPTIONS,
              pathPattern: 'assets/*',
            },
          ],
          s3OriginSource: {
            s3BucketSource: assetsBucket,
          },
        },
      ],
    })

    // This can be handled by `aws s3 sync` but we need to ensure invalidation of Cfn after deploy.
    new BucketDeployment(this, 'PublicFilesDeployment', {
      destinationBucket: assetsBucket,
      sources: [Source.asset(`next.out/assetsLayer.zip`)],
      accessControl: BucketAccessControl.PUBLIC_READ,
      // Invalidate all paths after deployment.
      distributionPaths: ['/*'],
      distribution: cfnDistro,
    })

    new CfnOutput(this, 'cfnDistroUrl', { value: cfnDistro.distributionDomainName })
    new CfnOutput(this, 'defaultApiGwUrl', { value: apiGwDefault.apiEndpoint })
    new CfnOutput(this, 'imagesApiGwUrl', { value: apiGwImages.apiEndpoint })
    new CfnOutput(this, 'assetsBucketUrl', { value: assetsBucket.bucketDomainName })
  }
}
```

## Sharp

Besides handler (wrapper) itself, underlying NextJS also requires sharp binaries.
To build those, we use `npm install` with some extra parametes. Then we zip all sharp dependencies and compress it to easily importable zip file.

```
const code = require.resolve('@sladg/nextjs-lambda/sharp-layer')

const sharpLayer = new LayerVersion(this, 'SharpLayer', {
  code: Code.fromAsset(code)
})
```

## Packaging

In order to succefully deploy, you firstly need to include `target: 'standalone'` in your `next.config.js` setup.
Make sure to use NextJS in version 12 or above so this is properly supported.

Once target is set, you can go on and use your `next build` command as you normally would.
To package everything, make sure to be in your project root folder and next folder `.next` and `public` exist. Packaging is done via NPM CLI command of `@slack/nextjs-lambda package`.

It will create `next.out/` folder with 3 zip packages. One zip Lambda's code, one is dependencies layer and one is assets layer.

- code zip: include all files generated by next that are required to run on Lambda behind ApiGateway. Original handler as well as new server handler are included. Use `handler.handler` for custom one or `server.handler` for original one.
- dependencies layer: all transpilied `node_modules`. Next includes only used files, dramatically reducing overall size.
- assets layer: your public folder together with generated assets. Keep in mind that to public refer file, you need to include it in `public/assets/` folder, not just in public. This limitation dramatically simplifies whole setup. This zip file is uploaded to S3, it's not included in Lambda code.

### Server handler

Custom wrapper around NextServer to allow for passing ApiGateway events into Next server.

Cloudfront paths used:

- `default`
- `_next/data/*`

### Static assets

Next uses multiple directories to determine which file should be served. By default next provides us with list of routes for API/images/assets/pages. To simplify the process as much as possible, we are tapping into resulting paths.

We are packaging those assets to simulate output structure and we are using S3 behind CloudFront to serve those files.
Also, Image Handler is tapping into S3 to provide images, so correct folder structure is crucial.

Cloudfront paths used:

- `_next/*`
- `assets/*`

# Versioning

This package exposes two CLI functions intended to deal with versioning your application and releasing.

Motivation behind is to get rid of huge dependencies and over-kill implementations such as @auto-it, release-it or semver. Those are bulky and unncessarily complex.

## Guess

Simple CLI command that takes commit message and current version and outputs (stdout) next version based on keywords inside commit message.

## Shipit

Similar to guess command, however, it automatically tags a commit on current branch and creates release branch for you so hooking up pipelines is as simple as it can be. Version is automatically bumped in common NPM and PHP files (package.json, package-lock.json and composer.json).

Simply call `@sladg/next-lambda shipit` on any branch and be done.


# TODO

- Explain scripts used for packaging Next app,
- Add CDK examples on how to set it up,
- Export CDK contruct for simple plug-n-play use,
- Use lib/index.ts as single entry and export all paths/functions from it (including zip paths).
- Consider using \*.svg, \*.png, \*.jpeg etc. as routing rule for Cloudfront to distinguish between assets and pages.
- Add command for guessing version bumps from git commits & keywords, existing solutions are horendously huge, we just need a simple version bumping.

# Disclaimer

At this point, advanced features were not tested with this setup. This includes:

- `GetServerSideProps`,
- middleware,
- ISR and fallbacks,
- streaming,
- custom babel configuration.

I am looking for advanced projects implementing those features, so we can test them out! Reach out to me!
