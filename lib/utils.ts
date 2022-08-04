import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { IncomingMessage, ServerResponse } from 'http'
import { NextUrlWithParsedQuery } from 'next/dist/server/request-meta'
import { Readable } from 'stream'

// Make header keys lowercase to ensure integrity.
export const normalizeHeaders = (headers: Record<string, any>) =>
  Object.entries(headers).reduce((acc, [key, value]) => ({ ...acc, [key.toLowerCase()]: value }), {} as Record<string, string>)

// Handle fetching of S3 object before optimization happens in nextjs.
export const requestHandler =
  (bucketName: string) =>
  async (req: IncomingMessage, res: ServerResponse, url?: NextUrlWithParsedQuery): Promise<void> => {
    if (!url) {
      throw new Error('URL is missing from request.')
    }

    // S3 expects keys without leading `/`
    const trimmedKey = url.href.startsWith('/') ? url.href.substring(1) : url.href

    const client = new S3Client({})
    const response = await client.send(new GetObjectCommand({ Bucket: bucketName, Key: trimmedKey }))

    if (!response.Body) {
      throw new Error(`Could not fetch image ${trimmedKey} from bucket.`)
    }

    const stream = response.Body as Readable

    const data = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.once('end', () => resolve(Buffer.concat(chunks)))
      stream.once('error', reject)
    })

    res.statusCode = 200

    if (response.ContentType) {
      res.setHeader('Content-Type', response.ContentType)
    }

    if (response.CacheControl) {
      res.setHeader('Cache-Control', response.CacheControl)
    }

    res.write(data)
    res.end()
  }
