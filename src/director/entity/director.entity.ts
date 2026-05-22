import { BaseTable } from "src/common/entity/base-table.entity";
import { Movie } from "src/movie/entity/movie.entity";
import { Column, Entity, OneToMany, PrimaryGeneratedColumn, Unique } from "typeorm";


// 감독은 동명이인이 있을 수 있으니 name은 unique로 안하는 게 나을 것 같다.
// dob date of birthday 약어 자주 사용
@Entity()

// [name,dob]를 묶어서 두개가 같은 사람은 이 프로젝트에서 같은 사람으로 간주하기 위해 사용
@Unique('UQ_DIRECTOR_NAME_DOB',['name','dob'])
export class Director extends BaseTable {
    @PrimaryGeneratedColumn()
    id:number;

    @Column()
    name:string;

    @Column()
    dob:Date;

    @Column()
    nationality:string;

    @OneToMany(
        ()=>Movie,
        (movie)=>movie.director
    )
    movies:Movie[]
}
