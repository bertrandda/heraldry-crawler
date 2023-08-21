import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const uploadFile = async (key: string, body: string) => {
    const s3 = new S3Client({
        region: 'eu-002',
        endpoint: process.env.S3_ENDPOINT,
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        },
    });

    const buffer = Buffer.from(body);

    const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key.replace(/^\//, ''),
        Body: buffer,
        ContentEncoding: 'base64',
        ContentType: 'application/json',
    });

    await s3.send(command);
}
