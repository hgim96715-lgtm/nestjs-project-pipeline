-- CreateTable
CREATE TABLE "chat" (
    "createAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL,
    "id" SERIAL NOT NULL,
    "message" VARCHAR NOT NULL,
    "authorId" INTEGER,
    "chatRoomId" INTEGER,

    CONSTRAINT "PK_9d0b2ba74336710fd31154738a5" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_room" (
    "createAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL,
    "id" SERIAL NOT NULL,

    CONSTRAINT "PK_8aa3a52cf74c96469f0ef9fbe3e" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_room_user_user" (
    "chatRoomId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "PK_47e08dba2a33412d5f4a08f0848" PRIMARY KEY ("chatRoomId","userId")
);

-- CreateTable
CREATE TABLE "chat_room_users_user" (
    "chatRoomId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "PK_78b0004f767c1273a6d13c1220b" PRIMARY KEY ("chatRoomId","userId")
);

-- CreateTable
CREATE TABLE "director" (
    "createAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL,
    "id" SERIAL NOT NULL,
    "name" VARCHAR NOT NULL,
    "dob" TIMESTAMP(6) NOT NULL,
    "nationality" VARCHAR NOT NULL,

    CONSTRAINT "PK_b85b179882f31c43324ef124fea" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genre" (
    "createAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL,
    "id" SERIAL NOT NULL,
    "name" VARCHAR NOT NULL,

    CONSTRAINT "PK_0285d4f1655d080cfcf7d1ab141" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migrations" (
    "id" SERIAL NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "name" VARCHAR NOT NULL,

    CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movie" (
    "createAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL,
    "id" SERIAL NOT NULL,
    "title" VARCHAR NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "dislikeCount" INTEGER NOT NULL DEFAULT 0,
    "detailId" INTEGER NOT NULL,
    "directorId" INTEGER NOT NULL,
    "creatorId" INTEGER,

    CONSTRAINT "PK_cb3bb4d61cf764dc035cbedd422" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movie_detail" (
    "id" SERIAL NOT NULL,
    "detail" VARCHAR NOT NULL,

    CONSTRAINT "PK_e3014d1b25dbc9648b9abc58537" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movie_file" (
    "id" SERIAL NOT NULL,
    "path" VARCHAR NOT NULL,
    "originalName" VARCHAR NOT NULL,
    "mimetype" VARCHAR NOT NULL,
    "size" INTEGER NOT NULL,
    "movieId" INTEGER,

    CONSTRAINT "PK_676d1b13f7421d5de1ef09486ee" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movie_genres_genre" (
    "movieId" INTEGER NOT NULL,
    "genreId" INTEGER NOT NULL,

    CONSTRAINT "PK_aee18568f9fe4ecca74f35891af" PRIMARY KEY ("movieId","genreId")
);

-- CreateTable
CREATE TABLE "movie_user_like" (
    "movieId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "isLike" BOOLEAN NOT NULL,

    CONSTRAINT "PK_55397b3cefaa6fc1b47370fe84e" PRIMARY KEY ("movieId","userId")
);

-- CreateTable
CREATE TABLE "user" (
    "createAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL,
    "id" SERIAL NOT NULL,
    "email" VARCHAR NOT NULL,
    "password" VARCHAR NOT NULL,
    "role" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IDX_5993417e877e4816eb6a47288c" ON "chat_room_user_user"("chatRoomId");

-- CreateIndex
CREATE INDEX "IDX_9f8dc4c491bcd9bedad166e446" ON "chat_room_user_user"("userId");

-- CreateIndex
CREATE INDEX "IDX_4abf95f2b061eff07204eb6928" ON "chat_room_users_user"("chatRoomId");

-- CreateIndex
CREATE INDEX "IDX_8fc13654c02f47079cdd00935b" ON "chat_room_users_user"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_DIRECTOR_NAME_DOB" ON "director"("name", "dob");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_dd8cd9e50dd049656e4be1f7e8c" ON "genre"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_a81090ad0ceb645f30f9399c347" ON "movie"("title");

-- CreateIndex
CREATE UNIQUE INDEX "REL_87276a4fc1647d6db559f61f89" ON "movie"("detailId");

-- CreateIndex
CREATE INDEX "IDX_1996ce31a9e067304ab168d671" ON "movie_genres_genre"("genreId");

-- CreateIndex
CREATE INDEX "IDX_985216b45541c7e0ec644a8dd4" ON "movie_genres_genre"("movieId");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_e12875dfb3b1d92d7d7c5377e22" ON "user"("email");

-- AddForeignKey
ALTER TABLE "chat" ADD CONSTRAINT "FK_ac7ca6f6fbe56f2a231369f2171" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chat" ADD CONSTRAINT "FK_e49029a11d5d42ae8a5dd9919a2" FOREIGN KEY ("chatRoomId") REFERENCES "chat_room"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chat_room_user_user" ADD CONSTRAINT "FK_5993417e877e4816eb6a47288cf" FOREIGN KEY ("chatRoomId") REFERENCES "chat_room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_room_user_user" ADD CONSTRAINT "FK_9f8dc4c491bcd9bedad166e4464" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chat_room_users_user" ADD CONSTRAINT "FK_4abf95f2b061eff07204eb69288" FOREIGN KEY ("chatRoomId") REFERENCES "chat_room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_room_users_user" ADD CONSTRAINT "FK_8fc13654c02f47079cdd00935b7" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movie" ADD CONSTRAINT "FK_87276a4fc1647d6db559f61f89a" FOREIGN KEY ("detailId") REFERENCES "movie_detail"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movie" ADD CONSTRAINT "FK_a32a80a88aff67851cf5b75d1cb" FOREIGN KEY ("directorId") REFERENCES "director"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movie" ADD CONSTRAINT "FK_b55916de756e46290d52c70fc04" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movie_file" ADD CONSTRAINT "FK_e4ace713f2b40dda8eb6f9d26e5" FOREIGN KEY ("movieId") REFERENCES "movie"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movie_genres_genre" ADD CONSTRAINT "FK_1996ce31a9e067304ab168d6715" FOREIGN KEY ("genreId") REFERENCES "genre"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movie_genres_genre" ADD CONSTRAINT "FK_985216b45541c7e0ec644a8dd4e" FOREIGN KEY ("movieId") REFERENCES "movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movie_user_like" ADD CONSTRAINT "FK_6a4d1cde9def796ad01b9ede541" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movie_user_like" ADD CONSTRAINT "FK_fd47c2914ce011f6966368c8486" FOREIGN KEY ("movieId") REFERENCES "movie"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
