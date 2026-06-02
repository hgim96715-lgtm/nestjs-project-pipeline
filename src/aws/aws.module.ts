import { Module } from '@nestjs/common';
import { S3Service } from './s3.service';
import { AwsController } from './aws.controller';

@Module({
    controllers: [AwsController],
    providers: [S3Service],
    exports: [S3Service],
})
export class AwsModule {}
