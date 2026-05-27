import { BaseTable } from 'src/common/entity/base-table.entity';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { Movie } from './movie.entity';
@Entity()
export class MovieFile {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    path: string;

    @Column()
    originalName: string;

    @Column()
    mimetype: string;

    @Column()
    size: number;

    // 순환 cascade(remove) 경고가 나서 cascade 옵션을 제거한다.
    @ManyToOne(() => Movie, (movie) => movie.files)
    movie: Movie;
}
