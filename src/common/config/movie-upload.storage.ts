import { diskStorage } from 'multer';
import { join } from 'path';
import { v4 } from 'uuid';

export const movieUploadStorage = diskStorage({
    destination: join(process.cwd(), 'public', 'temp'),
    filename: (req, file, callback) => {
        const split = file.originalname.split('.');

        let extension = 'mp4';
        if (split.length > 1) {
            extension = split[split.length - 1];
        }

        callback(null, `${v4()}_${Date.now()}.${extension}`);
    },
});
