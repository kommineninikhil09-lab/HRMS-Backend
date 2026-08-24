import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import {
  PostsRepository,
  PollsRepository,
  CommentsRepository,
  LikesRepository,
  PraiseRepository,
  AnnouncementsRepository,
} from './repositories';
import {
  PostsService,
  PollsService,
  CommentsService,
  LikesService,
  PraiseService,
  AnnouncementsService,
} from './services';
import {
  PostsController,
  PollsController,
  CommentsController,
  LikesController,
  PraiseController,
  AnnouncementsController,
} from './controllers';

@Module({
  imports: [DatabaseModule, AuditModule],
  providers: [
    PostsRepository,
    PollsRepository,
    CommentsRepository,
    LikesRepository,
    PraiseRepository,
    AnnouncementsRepository,
    PostsService,
    PollsService,
    CommentsService,
    LikesService,
    PraiseService,
    AnnouncementsService,
  ],
  controllers: [PostsController, PollsController, CommentsController, LikesController, PraiseController, AnnouncementsController],
  exports: [
    PostsRepository,
    PollsRepository,
    CommentsRepository,
    LikesRepository,
    PraiseRepository,
    AnnouncementsRepository,
    PostsService,
    PollsService,
    CommentsService,
    LikesService,
    PraiseService,
    AnnouncementsService,
  ],
})
export class CommunityModule {}
