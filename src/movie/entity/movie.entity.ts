import { BaseTable } from 'src/common/entity/base-table.entity';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    JoinColumn,
    OneToOne,
    ManyToMany,
    JoinTable,
    ManyToOne,
    OneToMany,
} from 'typeorm';
import { MovieDetail } from './movie-detail.entity';
import { Genre } from 'src/genre/entity/genre.entity';
import { Director } from 'src/director/entity/director.entity';
import { MovieFile } from './movie-file.entity';
import { User } from 'src/user/entity/user.entity';
import { MovieUserLike } from './movie-user-like.entity';

@Entity()
export class Movie extends BaseTable {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    title: string;

    @Column({ default: 0 })
    likeCount: number;

    @Column({ default: 0 })
    dislikeCount: number;

    @OneToMany(() => MovieFile, (file) => file.movie, { cascade: true })
    files: MovieFile[];

    // 영화는 하나의 상세정보를 가진다.
    @OneToOne(
        () => MovieDetail,
        (detail) => detail.movie,
        // (MovieDetail)=>MovieDetail.id
        {
            cascade: true,
            nullable: false,
        },
    )
    @JoinColumn()
    detail: MovieDetail;

    // 영화는 여러 장르를 가질 수 있고, 장르는 여러 영화에 속할수 있기때문
    @ManyToMany(() => Genre, (genre) => genre.movies)
    @JoinTable()
    genres: Genre[];

    @ManyToOne(() => Director, (director) => director.movies, {
        cascade: true,
        nullable: false,
    })
    director: Director;

    @ManyToOne(() => User, (user) => user.createdMovies)
    creator: User;

    @OneToMany(() => MovieUserLike, (like) => like.movie)
    likedUsers: MovieUserLike[];
}
