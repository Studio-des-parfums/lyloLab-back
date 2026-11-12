import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';

/** Signed URLs stay valid this long (seconds). */
const URL_TTL = 15 * 60;

/** Private Cloudflare R2 bucket (S3-compatible API). */
@Injectable()
export class StorageService {
  private client: S3Client | null = null;

  private get bucket() {
    return process.env.R2_BUCKET ?? '';
  }

  private s3() {
    const { R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } =
      process.env;
    if (!R2_ENDPOINT || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new ServiceUnavailableException(
        "Stockage des fichiers non configuré (variables R2_*).",
      );
    }
    this.client ??= new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
    return this.client;
  }

  async put(key: string, body: Uint8Array, contentType: string) {
    const client = this.s3();
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    } catch (err) {
      const name = (err as { name?: string }).name ?? 'Error';
      console.error('[storage] envoi R2 échoué', key, err);
      throw new ServiceUnavailableException(
        name === 'AccessDenied'
          ? "Le stockage des photos refuse l'accès (droits du token R2)."
          : `Envoi de la photo impossible (${name}).`,
      );
    }
  }

  signedUrl(key: string) {
    return getSignedUrl(
      this.s3(),
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: URL_TTL },
    );
  }

  /** Best effort: an orphan file must not block the deletion in the DB. */
  async remove(keys: (string | null)[]) {
    const objects = keys.filter((k): k is string => !!k).map((Key) => ({ Key }));
    if (!objects.length) return;
    try {
      for (let i = 0; i < objects.length; i += 1000) {
        await this.s3().send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: objects.slice(i, i + 1000), Quiet: true },
          }),
        );
      }
    } catch (err) {
      console.error('[storage] suppression R2 échouée', keys, err);
    }
  }
}
