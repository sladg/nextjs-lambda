# NextJS Image Optimizer Handler

This is a wrapper for `next/server/image-optimizer` allowing to use S3.

It is intended to be used with `nextjs` deployments to Lambda.

## Usage

Create new lambda function with NODE_16 runtime in AWS.
Use

```
const sharpLayer: LayerVersion
const assetsBucket: Bucket

const code = require.resolve('@sladg/nextjs-lambda/image-handler/zip')

const imageOptimizerFn = new Function(this, 'LambdaFunction', {
      code: Code.fromAsset(code),
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

## Sharp

Besides handler (wrapper) itself, underlying NextJS also requires sharp binaries.
To build those, we use `npm install` with some extra parametes. Then we zip all sharp dependencies and compress it to easily importable zip file.

```
const code = require.resolve('@sladg/nextjs-lambda/sharp-layer')

const sharpLayer = new LayerVersion(this, 'SharpLayer', {
  code: Code.fromAsset(code)
})
```

## Notes

This is part of NextJS to Lambda deployment process. More info to follow.

## @TODO: Add Server-handler description
