import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EventsModule } from './events/events.module';
import { CategoriesModule } from './categories/categories.module';
import { TeamsModule } from './teams/teams.module';
import { ScoringTemplatesModule } from './scoring-templates/scoring-templates.module';
import { RegulationsModule } from './regulations/regulations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: false,
    }),
    AuthModule,
    UsersModule,
    EventsModule,
    CategoriesModule,
    TeamsModule,
    ScoringTemplatesModule,
    RegulationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
