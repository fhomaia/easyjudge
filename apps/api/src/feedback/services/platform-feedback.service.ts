import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformFeedback } from '../entities/platform-feedback.entity';
import { PlatformFeedbackDto } from '../dto/feedback.dto';
import { User } from '../../users/entities/user.entity';
import { IMPERSONATOR_EMAIL } from '../../common/constants/impersonation';
import { summarize, type FeedbackSummaryView } from './event-feedback.service';

@Injectable()
export class PlatformFeedbackService {
  constructor(
    @InjectRepository(PlatformFeedback)
    private readonly feedbackRepo: Repository<PlatformFeedback>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async create(userId: string, dto: PlatformFeedbackDto): Promise<void> {
    const user = await this.usersRepo.findOneByOrFail({ id: userId });
    await this.feedbackRepo.save(
      this.feedbackRepo.create({
        userId,
        rating: dto.rating,
        comment: dto.comment?.trim() || null,
        userRole: user.role,
        page: dto.page ?? null,
      }),
    );
  }

  // Só o dono da plataforma (mesma exceção fixa do "ver como", ver
  // IMPERSONATOR_EMAIL) vê as avaliações da Cheer Cup.
  async list(userId: string): Promise<{
    summary: FeedbackSummaryView;
    items: Array<{
      id: string;
      userName: string;
      userEmail: string;
      userRole: string;
      rating: number;
      comment: string | null;
      page: string | null;
      createdAt: Date;
    }>;
  }> {
    const requester = await this.usersRepo.findOneBy({ id: userId });
    if (requester?.email.toLowerCase() !== IMPERSONATOR_EMAIL) {
      throw new ForbiddenException();
    }
    const rows = await this.feedbackRepo.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
    return {
      summary: summarize(rows.map((r) => r.rating)),
      items: rows.map((r) => ({
        id: r.id,
        userName:
          `${r.user.firstName} ${r.user.lastName ?? ''}`.trim() || r.user.email,
        userEmail: r.user.email,
        userRole: r.userRole,
        rating: r.rating,
        comment: r.comment,
        page: r.page,
        createdAt: r.createdAt,
      })),
    };
  }
}
