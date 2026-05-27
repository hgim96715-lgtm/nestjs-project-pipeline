import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { rename } from 'fs/promises';
import { join } from 'path';
import { v4 } from 'uuid';
@Injectable()
export class MovieFilesPipe implements PipeTransform<Express.Multer.File[], Promise<Express.Multer.File[]>> {
    constructor(
        private readonly options: {
            maxSize: number;
            mimetype: string;
            maxCount: number;
        },
    ) {}

    async transform(values: Express.Multer.File[], metadata: ArgumentMetadata): Promise<Express.Multer.File[]> {
        if (!values) {
            throw new BadRequestException('movies 필드는 필수 입니다!');
        }
        const byteSize = this.options.maxSize * 1000000;

        values.forEach((value) => {
            if (value.size > byteSize) {
                throw new BadRequestException(
                    `${value.originalname}-${this.options.maxSize}MB 이하의 사이즈만 업로드 가능합니다.!`,
                );
            }
            if (value.mimetype !== this.options.mimetype) {
                throw new BadRequestException(
                    `${value.originalname}-${this.options.mimetype}이 일치하지 않습니다. 확인해주세요~!`,
                );
            }
        });
        if (values.length > this.options.maxCount) {
            throw new BadRequestException(`${this.options.maxCount}개 이상의 파일을 업로드 할 수 없습니다.!`);
        }

        return Promise.all(
            values.map(async (value) => {
                const split = value.originalname.split('.');
                let extension = 'mp4';
                if (split.length > 1) {
                    extension = split[split.length - 1];
                }
                //uuid_Date.mp4
                const filename = `${v4()}_${Date.now()}.${extension}`;
                const newPath = join(value.destination, filename);

                await rename(value.path, newPath);

                return {
                    ...value,
                    filename,
                    path: newPath,
                };
            }),
        );
    }
}
