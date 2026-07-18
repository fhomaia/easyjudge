import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { CategoriesController } from './controllers/categories.controller';
import { CategoriesService } from './services/categories.service';
import { EventsModule } from '../events/events.module';
import { ScoringTemplatesModule } from '../scoring-templates/scoring-templates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Category]),
    EventsModule,
    ScoringTemplatesModule,
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
