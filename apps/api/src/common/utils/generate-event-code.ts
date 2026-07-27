import { randomInt } from 'crypto';

// Sem 0/O, 1/I/L — evita confusão visual quando alguém digita o
// código à mão (ver EventsService.joinByCode).
const EVENT_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const EVENT_CODE_LENGTH = 8;

export function generateEventCode(): string {
  let code = '';
  for (let i = 0; i < EVENT_CODE_LENGTH; i++) {
    code += EVENT_CODE_ALPHABET[randomInt(EVENT_CODE_ALPHABET.length)];
  }
  return code;
}
