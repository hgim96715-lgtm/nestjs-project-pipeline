import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { DownloadPresignedUrlDto, PresignedUrlDto } from './dto/presigned-url.dto';
import { S3Service } from './s3.service';
import { Public } from 'src/auth/decorator/public.decorator';

@Controller('presigned-url')
export class AwsController {
    constructor(private readonly s3Service: S3Service) {}

    @Get()
    async getPresignedUrl(@Query() dto: PresignedUrlDto) {
        return await this.s3Service.createPutPresignedUrl(dto);
    }

    @Post()
    async postPresignedUrl(@Body() dto: PresignedUrlDto) {
        return await this.s3Service.createPutPresignedUrl(dto);
    }

    @Get('download')
    async getPresignedDownloadUrl(@Query() dto: DownloadPresignedUrlDto) {
        return await this.s3Service.createGetPresignedUrl(dto);
    }
}
