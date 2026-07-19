import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventMember } from '../entities/event-member.entity';
import { EventMemberRole } from '../enums/event-member-role.enum';
import { EventsService } from './events.service';
import { UsersService } from '../../users/services/users.service';
import { CreateEventStaffMemberDto } from '../dto/create-event-staff-member.dto';
import { UpdateEventStaffMemberDto } from '../dto/update-event-staff-member.dto';

export interface EventStaffMemberView {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  roles: EventMemberRole[];
  isOwner: boolean;
  isPending: boolean;
}

// Roster de acessos do evento — quem administra (Gerenciar acessos, ver
// EventStaffController) fica aqui, separado de EventsService (que já
// tinha a autorização "é admin?" mas não um CRUD de membros).
@Injectable()
export class EventStaffService {
  constructor(
    @InjectRepository(EventMember)
    private readonly membersRepo: Repository<EventMember>,
    private readonly eventsService: EventsService,
    private readonly usersService: UsersService,
  ) {}

  async list(eventId: string): Promise<EventStaffMemberView[]> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const members = await this.membersRepo.find({
      where: { aliasId: event.aliasId },
      order: { createdAt: 'ASC' },
    });
    return Promise.all(
      members.map((member) => this.toStaffView(member, event.createdById)),
    );
  }

  // Cria a pessoa com um ou mais papéis; se ela já existir no roster
  // (mesma conta, ou mesmo email pendente), soma os papéis novos aos
  // que já tinha em vez de duplicar/sobrescrever. Se o email já
  // corresponde a uma conta existente, já vincula o userId na hora
  // (mesmo padrão de JudgesService.create) — só fica pendente
  // (userId null) quando ninguém com esse email tem conta ainda.
  async create(
    eventId: string,
    dto: CreateEventStaffMemberDto,
  ): Promise<EventStaffMemberView> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const existingUser = await this.usersService.findByEmailInsensitive(
      dto.email,
    );
    const existing = await this.eventsService.findMemberByIdentity(
      event.aliasId,
      { userId: existingUser?.id ?? null, email: dto.email },
    );

    if (existing) {
      existing.roles = Array.from(new Set([...existing.roles, ...dto.roles]));
      const saved = await this.membersRepo.save(existing);
      return this.toStaffView(saved, event.createdById);
    }

    const member = this.membersRepo.create({
      aliasId: event.aliasId,
      userId: existingUser?.id ?? null,
      roles: dto.roles,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
    });
    const saved = await this.membersRepo.save(member);
    return this.toStaffView(saved, event.createdById);
  }

  async updateRoles(
    eventId: string,
    memberId: string,
    dto: UpdateEventStaffMemberDto,
    requesterId: string,
  ): Promise<EventStaffMemberView> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const member = await this.findMemberOrThrow(event.aliasId, memberId);
    this.assertNotOwnerUnlessSelf(
      member,
      event.createdById,
      requesterId,
      'alterar os papéis de',
    );
    member.roles = dto.roles;
    const saved = await this.membersRepo.save(member);
    return this.toStaffView(saved, event.createdById);
  }

  async remove(
    eventId: string,
    memberId: string,
    requesterId: string,
  ): Promise<void> {
    const event = await this.eventsService.findEventOrThrow(eventId);
    const member = await this.findMemberOrThrow(event.aliasId, memberId);
    this.assertNotOwnerUnlessSelf(
      member,
      event.createdById,
      requesterId,
      'remover',
    );
    await this.membersRepo.remove(member);
  }

  private async findMemberOrThrow(
    aliasId: string,
    memberId: string,
  ): Promise<EventMember> {
    const member = await this.membersRepo.findOneBy({
      id: memberId,
      aliasId,
    });
    if (!member) {
      throw new NotFoundException(
        'Pessoa não encontrada no roster deste evento.',
      );
    }
    return member;
  }

  // O dono (quem criou o evento, Event.createdById) só pode ter seus
  // próprios papéis alterados/removidos por ele mesmo — senão um admin
  // qualquer poderia tirar o admin do dono (ou removê-lo) antes de
  // removê-lo de vez, driblando a proteção.
  private assertNotOwnerUnlessSelf(
    member: EventMember,
    ownerUserId: string,
    requesterId: string,
    action: string,
  ): void {
    if (member.userId === ownerUserId && requesterId !== ownerUserId) {
      throw new ForbiddenException(
        `Somente o próprio dono do evento pode ${action} a si mesmo.`,
      );
    }
  }

  private async toStaffView(
    member: EventMember,
    ownerUserId: string,
  ): Promise<EventStaffMemberView> {
    let firstName = member.firstName ?? '';
    let lastName = member.lastName ?? '';
    let email = member.email ?? '';
    if (member.userId) {
      const user = await this.usersService.findById(member.userId);
      if (user) {
        firstName = user.firstName;
        lastName = user.lastName;
        email = user.email;
      }
    }
    return {
      id: member.id,
      userId: member.userId,
      firstName,
      lastName,
      email,
      roles: member.roles,
      isOwner: member.userId === ownerUserId,
      isPending: member.userId === null,
    };
  }
}
