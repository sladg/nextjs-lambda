# NextJS Lambda Utils

This is a project allowing to deploy Next applications (standalone options turned on) to AWS Lambda without hassle.

This is an alternative to existing Lambda@Edge implementation ([see](https://www.npmjs.com/package/@sls-next/lambda-at-edge)) as it has too many limitations (primarily inability to use env vars) and deployments take too long.

This library uses Cloudfront, S3, ApiGateway and Lambdas to deploy easily in seconds (hotswap supported).


- [NextJS Lambda Utils](#nextjs-lambda-utils)
  - [TL;DR](#tldr)
  - [Usage](#usage)
    - [next.config.js](#nextconfigjs)
    - [Server handler](#server-handler)
    - [Image handler](#image-handler)
    - [Via CDK](#via-cdk)
      - [Benchmark](#benchmark)
    - [Sharp layer](#sharp-layer)
    - [Next layer](#next-layer)
  - [Packaging](#packaging)
    - [Server handler](#server-handler-1)
    - [Static assets](#static-assets)
- [Versioning](#versioning)
  - [Guess](#guess)
  - [Shipit](#shipit)
- [TODO](#todo)
- [Disclaimer](#disclaimer)

## TL;DR
- In your NextJS project, set output to standalone.
- Run `npx @sladg/nextjs-lambda pack`
- Prepare CDK ([see](#via-cdk))
- Run `cdk deploy`

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


### Server handler

This is a Lambda entrypoint to handle non-asset requests. We need a way to start Next in lambda-friendly way and translate ApiGateway event into typical HTTP event. This is handled by server-handler, which sits alongside of next's `server.js` in standalone output.

### Image handler

Lambda consumes Api Gateway requests, so we need to create ApiGw proxy (v2) that will trigger Lambda.

Lambda is designed to serve `_next/image*` route in NextJS stack and replaces the default handler so we can optimize caching and memory limits for page renders and image optimization.

### Via CDK

See `NextStandaloneStack` construct in `lib/construct.ts`.

You can easily create `cdk/app.ts` and use following code:
```
#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import * as path from 'path'

import { NextStandaloneStack } from '@sladg/nextjs-lambda'

const assetsZipPath = path.resolve(__dirname, '../next.out/assetsLayer.zip')
const codeZipPath = path.resolve(__dirname, '../next.out/code.zip')
const dependenciesZipPath = path.resolve(__dirname, '../next.out/dependenciesLayer.zip')

const app = new cdk.App()

new NextStandaloneStack(app, 'StandaloneNextjsStack-2', {
	assetsZipPath,
	codeZipPath,
	dependenciesZipPath,
})
```

This imports pre-made construct, you only need to worry about paths to outputed zip files from CLI `pack` command.

> More granular CDK construct coming soon.

#### Benchmark

Creation of stack: 385sec (6min 25sec)
Run #2 436sec (7min 16sec)
Deletion of stack: 262sec (4min 22sec)
Update of stack:


### Sharp layer

Besides handler (wrapper) itself, underlying NextJS also requires sharp binaries.
To build those, we use `npm install` with some extra parametes. Then we zip all sharp dependencies and compress it to easily importable zip file.

```
import { sharpLayerZipPath } from '@sladg/nextjs-lambda'

const sharpLayer = new LayerVersion(this, 'SharpDependenciesLayer', {
  code: Code.fromAsset(sharpLayerZipPath)
})
```

### Next layer

To provide both image and server handlers with all depdencies (next is using `require.resolve` inside, so it cannot be bundled standalone for now).

We pre-package this layer so it can be included in Lambda without hassle.
```
import { nextLayerZipPath } from '@sladg/nextjs-lambda'

const nextLayer = new LayerVersion(this, 'NextDependenciesLayer', {
  code: Code.fromAsset(nextLayerZipPath)
})
```

## Packaging

In order to succefully deploy, you firstly need to include `target: 'standalone'` in your `next.config.js` setup.
Make sure to use NextJS in version 12 or above so this is properly supported.

Once target is set, you can go on and use your `next build` command as you normally would.
To package everything, make sure to be in your project root folder and next folder `.next` and `public` exist. Packaging is done via NPM CLI command of `@slack/nextjs-lambda package`.

It will create `next.out/` folder with 3 zip packages. One zip Lambda's code, one is dependencies layer and one is assets layer.

- code zip: include all files generated by next that are required to run on Lambda behind ApiGateway. Original handler as well as new server handler are included. Use `server-handler.handler` for custom one or `server.handler` for original one.
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

Keep in minda, Cloudfront does not allow for multiple regex patterns in single origin, so using extensions to distinguish image/server handlers is not doable.

# Versioning

This package exposes two CLI functions intended to deal with versioning your application and releasing.

Motivation behind is to get rid of huge dependencies and over-kill implementations such as @auto-it, release-it or semver. Those are bulky and unncessarily complex.

## Guess

Simple CLI command that takes commit message and current version and outputs (stdout) next version based on keywords inside commit message.

## Shipit

Similar to guess command, however, it automatically tags a commit on current branch and creates release branch for you so hooking up pipelines is as simple as it can be. Version is automatically bumped in common NPM and PHP files (package.json, package-lock.json and composer.json).

Simply call `@sladg/next-lambda shipit` on any branch and be done.

# TODO

- Move Next into peer dependency and build layer manually via npx. Parse next version from parent (allow parameter) to ensure compatibility with our implementation.
- Move CDK into peer dependency and allow for CDK dependencies to not be used / to have version defined in upstream.

# Disclaimer

At this point, advanced features were not tested with this setup. This includes:

- `GetServerSideProps`,
- middleware,
- ISR and fallbacks,
- streaming,
- custom babel configuration.

I am looking for advanced projects implementing those features, so we can test them out! Reach out to me!



