# NextJS Lambda Utils

This is a project allowing to deploy Next applications (standalone options turned on) to AWS Lambda without hassle.

This is an alternative to existing Lambda@Edge implementation ([see](https://www.npmjs.com/package/@sls-next/lambda-at-edge)) as it has too many limitations (primarily inability to use env vars) and deployments take too long.

This library uses Cloudfront, S3, ApiGateway and Lambdas to deploy easily in seconds (hotswap supported).


## TL;DR
- In your NextJS project, set output to standalone.
- Run `next build` (will generate standalone next folder).
- Run `npx --package @sladg/nextjs-lambda cli pack` (will create ZIPs).
- Run `npx --package @sladg/nextjs-lambda cli deploy` (will deploy to AWS).
- Profit 🎉

```
next.config.js

const path = require('path')

module.exports = {
	compress: false,
	output: 'standalone',
	experimental: {
		esmExternals: false, // optional
		externalDir: true, // optional
		outputFileTracingRoot: path.join(__dirname, '../../'), // monorepo option
	}
}
```


- [x] Render frontfacing pages in Lambda,
- [x] Render API routes in Lambda,
- [x] Image optimization,
- [x] NextJS headers (next.config.js),
- [x] [GetStaticPaths](https://nextjs.org/docs/basic-features/data-fetching/get-static-paths),
- [x] next-intl (i18n),
- [x] [Middleware](https://nextjs.org/docs/advanced-features/middleware),
- [x] [GetServerSideProps](https://nextjs.org/docs/basic-features/data-fetching/get-server-side-props),
- [x] [GetStaticProps](https://nextjs.org/docs/basic-features/data-fetching/get-static-props),
- [x] NextJS rewrites (next.config.js),
- [x] Monorepo support,
- [x] <del>Bundle Sharp together with image optimizer so Next uses it.</del>  Custom python optimizer used,
- [x] <del>Custom babel configuration</del>  Not possible with Next standalone output,
- [ ] [ISR and fallbacks](https://nextjs.org/docs/basic-features/data-fetching/incremental-static-regeneration)
- [ ] [Streaming](https://nextjs.org/docs/advanced-features/react-18/streaming)


## Usage

We need to create 2 lambdas in order to use NextJS. First one is handling pages/api rendering, second is solving image optimization.

This division makes it easier to control resources and specify sizes and timeouts as those operations are completely different.

Loading of assets and static content is handled via Cloudfront and S3 origin, so there is no need for specifying this behaviour in Lambda or handling it anyhow.

### Server handler

This is a Lambda entrypoint to handle non-asset requests. We need a way to start Next in lambda-friendly way and translate ApiGateway event into typical HTTP event. This is handled by server-handler, which sits alongside of next's `server.js` in standalone output.

### Image handler

Lambda consumes ApiGateway requests, so we need to create ApiGw proxy (v2) that will trigger Lambda.

Lambda is designed to serve `_next/image*` route in NextJS stack and replaces the default handler so we can optimize caching and memory limits for page renders and image optimization.

Optimizer used: [imaginex](https://github.com/sladg/imaginex-lambda)

### Environment variables
If using CDK, you can easily pass environment variables to Lambda. If `.env` file is present during build time, this will get picked up and passed to Lambda as file.

If env variables with prefix `NEXT_` are present during deployment time, those will get picked up and passed as environment variables to Lambda.

The priority for resolving env variables is as follows (stopping when found):
- `process.env`
- `.env.$(NODE_ENV).local`
- `.env.local (Not checked when NODE_ENV is test.)`
- `.env.$(NODE_ENV)`
- `.env`

Frontend environment variables are automatically resolved during build time! You will not be able to set `NEXT_PUBLIC_` variables during deployment / runtime.

### Via CDK

See `NextStandaloneStack` construct in `lib/cdk/app.ts`.
Or just use `cli deploy` command so you don't have to manage CDK yourself. See CLI help command for all congiruation, notably, it's possible to set Timeout and Memory for lambda from CLI. It is advised to always use custom `--stackName` in `deploy` command as it will affect names of all resources and will help you distinguish between different environments/applications.

If you want to use it programatically, see [this guide](./docs/CDK.md).

## Packaging

In order to succefully deploy, you firstly need to include `output: 'standalone'` in your `next.config.js` setup. Secondly, any compression should be turned off as AWS is taking care of that. See `compress: false` in your config.
Make sure to use NextJS in version 12 or above so this is properly supported.

Once output is set, you can go on and use your `next build` command as you normally would.
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
