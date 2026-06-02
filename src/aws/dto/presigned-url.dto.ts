import { IsOptional, IsString } from 'class-validator';

export class PresignedUrlDto {
    @IsOptional()
    @IsString()
    key?: string;

    @IsOptional()
    @IsString()
    contentType?: string;
}

export class DownloadPresignedUrlDto {
    @IsString()
    key!: string;
}

