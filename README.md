# NextJS Lambda Utils

This is a project allowing to deploy Next applications (standalone options turned on) to AWS Lambda without hassle.

This is an alternative to existing Lambda@Edge implementation ([see](https://www.npmjs.com/package/@sls-next/lambda-at-edge)) as it has too many limitations (primarily inability to use env vars) and deployments take too long.

This library uses Cloudfront, S3, ApiGateway and Lambdas to deploy easily in seconds (hotswap supported).


- [NextJS Lambda Utils](#nextjs-lambda-utils)
  - [TL;DR](#tldr)
  - [Usage](#usage)
    - [next.config.js](#nextconfigjs)
    - [Monorepos](#monorepos)
    - [Server handler](#server-handler)
    - [Image handler](#image-handler)
    - [Environment variables](#environment-variables)
    - [Via CDK](#via-cdk)
      - [Benchmark](#benchmark)
  - [Packaging](#packaging)
    - [Server handler](#server-handler-1)
    - [Static assets](#static-assets)
- [Versioning](#versioning)
  - [Guess](#guess)
  - [Shipit](#shipit)

## TL;DR
- In your NextJS project, set output to standalone.
- Run `next build` (will generate standalone next folder).
- Run `npx --package @sladg/nextjs-lambda next-utils pack` (will create ZIPs).
- Run `npx --package @sladg/nextjs-lambda next-utils deploy` (will deploy to AWS).
- Profit 🎉

---

- [x] Render frontfacing pages in Lambda
- [x] Render API routes in Lambda
- [x] Image optimization
- [x] NextJS headers (next.config.js)
- [x] [GetStaticPaths](https://nextjs.org/docs/basic-features/data-fetching/get-static-paths)
- [x] next-intl (i18n)
- [x] [Middleware](https://nextjs.org/docs/advanced-features/middleware)
- [x] [GetServerSideProps](https://nextjs.org/docs/basic-features/data-fetching/get-server-side-props)
- [x] [GetStaticProps](https://nextjs.org/docs/basic-features/data-fetching/get-static-props)
- [x] NextJS rewrites (next.config.js)
- [x] Monorepo support
- [ ] [ISR and fallbacks](https://nextjs.org/docs/basic-features/data-fetching/incremental-static-regeneration)
- [ ] [Streaming](https://nextjs.org/docs/advanced-features/react-18/streaming)
- [ ] Custom babel configuration
- [ ] Bundle Sharp together with image optimizer so Next uses it.


## Usage

We need to create 2 lambdas in order to use NextJS. First one is handling pages/api rendering, second is solving image optimization.

This division makes it easier to control resources and specify sizes and timeouts as those operations are completely different.

Loading of assets and static content is handled via Cloudfront and S3 origin, so there is no need for specifying this behaviour in Lambda or handling it anyhow.

### next.config.js

The only requirement is to change your Next12 config to produce standalone output via `output: 'standalone'` and turn off compressions `compress: false`.

In case you want to control caching (for example to not cache API routes), you can use `headers` option in `next.config.js`. Cloudfront will respect those headers and cache accordingly. You can set caching based on methods, paths or headers (useful for setting cache control in case of user logins).

Sometimes, Next will transpile some modules as ESM and some modules as CJS. This is not supported by Lambda, so we need to transpile all modules to CJS. This can be done by adding `experimental.esmExternals: false` to `next.config.js`. You will need this when Lambda is giving you Internal Error and Cloudwatch logs tell you that `import('XYZ')` cannot be resolved.

It is also possible to use `"type": "module"` in `package.json` with combination of naming your next config `next.config.mjs`, however this feature is currently not  tested.

See:
- https://github.com/vercel/next.js/pull/33637
- https://github.com/vercel/next.js/issues/24334
- https://github.com/vercel/next.js/issues/34412

### Monorepos

In case you are using monorepo, there are few more requirements.
Firstly, you need to setup `outputFileTracing` in your `next.config.js` see: https://github.com/vercel/next.js/issues/36386#issuecomment-1137665939.

Secondly, you need to setup `hoistingLimits: workspace`. We need `node_modules` to actually contain all the dependencies in order for NextJS to pick them up for standalone build.

Tested with Turbo@1.5.5 and Yarn@3.2.4


### Server handler

This is a Lambda entrypoint to handle non-asset requests. We need a way to start Next in lambda-friendly way and translate ApiGateway event into typical HTTP event. This is handled by server-handler, which sits alongside of next's `server.js` in standalone output.

### Image handler

Lambda consumes ApiGateway requests, so we need to create ApiGw proxy (v2) that will trigger Lambda.

Lambda is designed to serve `_next/image*` route in NextJS stack and replaces the default handler so we can optimize caching and memory limits for page renders and image optimization.

### Environment variables
If using CDK, you can easily pass environment variables to Lambda. If `.env` file is present during build time, this will get picked up and passed to Lambda as file.

If env variables with prefix `NEXT_` are present during deployment time, those will get picked up and passed as environment variables to Lambda.

The priority for resolving env variables is as follows (stopping when found):
- `process.env`
- `.env.$(NODE_ENV).local`
- `.env.local (Not checked when NODE_ENV is test.)`
- `.env.$(NODE_ENV)`
- `.env`

With this, you can pass `.env` files during build time and overwrite / extend the configuration during depoyment time. You can also control what gets passed to frontend part of application by using `NEXT_PUBLIC_` prefix.

### Via CDK

See `NextStandaloneStack` construct in `cdk/example.ts`.
Or just use `next-utils deploy` command so you don't have to manage CDK yourself.

#### Benchmark

Creation of stack:
- Run #1 **385sec** (6min 25sec)
- Run #2 **436sec** (7min 16sec)
- Run #3 **383sec** (6min 23sec)
- Run #4 **366sec** (6min 6sec)
- Run #5 **376sec** (6min 16sec)

Deletion of stack:
- Run #1 **262sec** (4min 22sec)
- Run #2 **319sec** (5m 19sec)

Update of stack:
- Run #1 **92sec** (1min 32sec)
- Run #2 **5sec** (no changes)
- Run #3 **3sec** (no changes)
- Run #4 **164sec** (2min 44sec)
- Run #5 **62sec** (1min 2sec) (no changes, used `next-utils deploy`)

We are looking at 6-8min for creation and 1-3min for update. This is a huge improvement over existing Lambda@Edge implementation.

## Packaging

In order to succefully deploy, you firstly need to include `target: 'standalone'` in your `next.config.js` setup. Secondly, any compression should be turned off as AWS is taking care of that. See `compress: false` in your config.
Make sure to use NextJS in version 12 or above so this is properly supported.

Once target is set, you can go on and use your `next build` command as you normally would.
To package everything, make sure to be in your project root folder and next folder `.next` and `public` exist. Packaging is done via NPM CLI command of `@slack/nextjs-lambda pack`.

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

Keep in minda, Cloudfront does not allow for multiple regex patterns in single origin, so using extensions to distinguish image/server handlers is not doable.

# Versioning

This package exposes two CLI functions intended to deal with versioning your application and releasing.

Motivation behind is to get rid of huge dependencies and over-kill implementations such as @auto-it, release-it or semver. Those are bulky and unncessarily complex.

## Guess

Simple CLI command that takes commit message and current version and outputs (stdout) next version based on keywords inside commit message.

## Shipit

Similar to guess command, however, it automatically tags a commit on current branch and creates release branch for you so hooking up pipelines is as simple as it can be. Version is automatically bumped in common NPM and PHP files (package.json, package-lock.json and composer.json).

Simply call `@sladg/next-lambda shipit` on any branch and be done.
