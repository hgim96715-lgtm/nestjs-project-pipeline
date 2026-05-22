import {CreateDateColumn, UpdateDateColumn, VersionColumn} from 'typeorm';

export class BaseTable{

    @CreateDateColumn()
    createAt:Date;

    @UpdateDateColumn()
    updateAt:Date;

    @VersionColumn()
    version:number;
}