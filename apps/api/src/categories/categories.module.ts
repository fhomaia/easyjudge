import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { CategoryCriteriaSettings } from './entities/category-criteria-settings.entity';
import { CategoriesController } from './controllers/categories.controller';
import { CategoryCriteriaController } from './controllers/category-criteria.controller';
import { CategoriesService } from './services/categories.service';
import { CategoryCriteriaService } from './services/category-criteria.service';
import { EventsModule } from '../events/events.module';
import { ScoringTemplatesModule } from '../scoring-templates/scoring-templates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Category, CategoryCriteriaSettings]),
    EventsModule,
    ScoringTemplatesModule,
  ],
  controllers: [CategoriesController, CategoryCriteriaController],
  providers: [CategoriesService, CategoryCriteriaService],
  // Usado pela ficha de inscrição (rótulos e critérios das categorias).
  exports: [CategoryCriteriaService],
})
export class CategoriesModule {}
