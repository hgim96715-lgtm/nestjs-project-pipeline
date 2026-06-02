import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { envVariableKeys } from 'src/common/const/env.const';
import { DownloadPresignedUrlDto, PresignedUrlDto } from './dto/presigned-url.dto';

@Injectable()
export class S3Service {
    public readonly client: S3Client;
    private readonly bucket: string;

    constructor(private readonly configService: ConfigService) {
        const region = this.configService.get<string>(envVariableKeys.awsRegion);
        const bucket = this.configService.get<string>(envVariableKeys.awsS3Bucket);

        if (!region) {
            throw new Error(`${envVariableKeys.awsRegion} is required`);
        }
        if (!bucket) {
            throw new Error(`${envVariableKeys.awsS3Bucket} is required`);
        }

        this.client = new S3Client({ region });
        this.bucket = bucket;
    }

    async createPutPresignedUrl(dto: PresignedUrlDto) {
        const key = `temp/${randomUUID()}`;
        const contentType = dto.contentType;

        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            ...(contentType ? { ContentType: contentType } : {}),
        });

        const url = await getSignedUrl(this.client, command, { expiresIn: 60 * 5 });

        return {
            method: 'PUT',
            url,
            key,
            bucket: this.bucket,
            ...(contentType ? { contentType } : {}),
        };
    }

    async createGetPresignedUrl(dto: DownloadPresignedUrlDto) {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: dto.key,
        });

        const url = await getSignedUrl(this.client, command, { expiresIn: 60 * 5 });

        return {
            method: 'GET',
            url,
            key: dto.key,
            bucket: this.bucket,
        };
    }
}
