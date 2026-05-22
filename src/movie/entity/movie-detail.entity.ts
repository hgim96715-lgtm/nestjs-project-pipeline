import { Column, Entity, PrimaryGeneratedColumn  } from "typeorm";
import { Movie } from "./movie.entity";

@Entity()
export class MovieDetail {
    @PrimaryGeneratedColumn()
    id:number;

    @Column()
    detail:string;

    movie:Movie;

}