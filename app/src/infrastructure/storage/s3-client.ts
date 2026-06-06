import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorageCredentials } from "@/infrastructure/config/integration";
import type { PresignResult } from "./types";

// S3 兼容存储 driver(MinIO 本地 / Supabase 临时 / 阿里云 OSS 生产,仅改 env 切端点)。
// 单例经 globalThis 防 HMR 泄漏(同 prisma client 套路)。
// 两个 client:服务端自用(内网 endpoint 做 move/delete/put)+ 预签名(主机可达
// publicEndpoint,签出的 URL 浏览器能直传;docker 内 minio:9000 浏览器不可达故必须分开)。
const globalForS3 = globalThis as unknown as {
  __s3Client?: S3Client;
  __s3Presign?: S3Client;
};

function makeClient(endpoint: string): S3Client {
  const c = getStorageCredentials();
  return new S3Client({
    endpoint,
    region: c.region,
    forcePathStyle: c.forcePathStyle,
    credentials: { accessKeyId: c.accessKey, secretAccessKey: c.secretKey },
  });
}

function client(): S3Client {
  return (globalForS3.__s3Client ??= makeClient(getStorageCredentials().endpoint));
}

function presignClient(): S3Client {
  return (globalForS3.__s3Presign ??= makeClient(getStorageCredentials().publicEndpoint));
}

function bucket(): string {
  return getStorageCredentials().bucket;
}

/**
 * 预签名 PUT 直传 URL(浏览器直传,不耗服务端内存/时长)。默认 5 分钟过期。
 * 传 contentLength 则签进 Content-Length:浏览器 PUT 须精确匹配该字节数,
 * 把"声明大小"硬约束到对象存储层(预签名 PUT 本身不限大小的兜底)。
 */
export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  opts?: { contentLength?: number; expiresIn?: number },
): Promise<PresignResult> {
  const url = await getSignedUrl(
    presignClient(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
      ContentLength: opts?.contentLength,
    }),
    { expiresIn: opts?.expiresIn ?? 300 },
  );
  return { uploadUrl: url, key };
}

/** 服务端直传(小对象/服务端生成内容)。大文件走 getSignedUploadUrl 直传。 */
export async function putObject(key: string, body: Uint8Array | Buffer, contentType: string): Promise<void> {
  await client().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }),
  );
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/** 提交时把 staging 对象移到 public 前缀(copy + delete),避免未提交的孤儿公开文件。 */
export async function moveObject(fromKey: string, toKey: string): Promise<void> {
  const b = bucket();
  await client().send(
    new CopyObjectCommand({ Bucket: b, CopySource: `${b}/${fromKey}`, Key: toKey }),
  );
  await client().send(new DeleteObjectCommand({ Bucket: b, Key: fromKey }));
}

/** 对象公网读 URL。优先 publicBaseUrl(CDN/桶域名);否则 path-style publicEndpoint/bucket/key。 */
export function publicUrl(key: string): string {
  const c = getStorageCredentials();
  const base = c.publicBaseUrl || `${c.publicEndpoint.replace(/\/$/, "")}/${c.bucket}`;
  return `${base.replace(/\/$/, "")}/${key}`;
}
