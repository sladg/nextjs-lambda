process.env.NODE_ENV = "production"
// Set NEXT_SHARP_PATH environment variable
// ! Make sure this comes before the fist import
process.env.NEXT_SHARP_PATH = require.resolve("sharp")

import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { defaultConfig, NextConfigComplete } from "next/dist/server/config-shared"
import { imageOptimizer as nextImageOptimizer, ImageOptimizerCache } from "next/dist/server/image-optimizer"
import { ImageConfigComplete } from "next/dist/shared/lib/image-config"
import { normalizeHeaders, requestHandler } from "./utils"

const sourceBucket = process.env.S3_SOURCE_BUCKET ?? undefined

// @TODO: Allow passing params as env vars.
const nextConfig = {
  ...(defaultConfig as NextConfigComplete),
  images: {
    ...(defaultConfig.images as ImageConfigComplete),
    // ...(domains && { domains }),
    // ...(deviceSizes && { deviceSizes }),
    // ...(formats && { formats }),
    // ...(imageSizes && { imageSizes }),
    // ...(dangerouslyAllowSVG && { dangerouslyAllowSVG }),
    // ...(contentSecurityPolicy && { contentSecurityPolicy }),
  },
}

const optimizer = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    if (!sourceBucket) {
      throw new Error("Bucket name must be defined!")
    }

    const imageParams = ImageOptimizerCache.validateParams(
      { headers: event.headers } as any,
      event.queryStringParameters!,
      nextConfig,
      false
    )

    if ("errorMessage" in imageParams) {
      throw new Error(imageParams.errorMessage)
    }

    const optimizedResult = await nextImageOptimizer(
      { headers: normalizeHeaders(event.headers) } as any,
      {} as any, // res object is not necessary as it's not actually used.
      imageParams,
      nextConfig,
      requestHandler(sourceBucket)
    )

    console.log(optimizedResult)

    return {
      statusCode: 200,
      body: optimizedResult.buffer.toString("base64"),
      isBase64Encoded: true,
      headers: { Vary: "Accept", "Content-Type": optimizedResult.contentType },
    }
  } catch (error: any) {
    console.error(error)
    return {
      statusCode: 500,
      body: error?.message || error?.toString() || error,
    }
  }
}

export const handler = optimizer
