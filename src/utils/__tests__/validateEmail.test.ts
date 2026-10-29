import database from '../../../db.json';
import { sanitizeEmail, validateEmail } from '../index';

/**
 * Covers QA ticket "some users cannot log in - app says invalid email".
 *
 * Reported by Ray for Luigi (luigi@carluccio.it) and John (john@silva.com.br),
 * both of whom have a two letter country code at the end of their address.
 */
describe('validateEmail', () => {
    describe('the two accounts reported in the ticket', () => {
        it('accepts Luigi, whose address ends in a two letter country code', () => {
            expect(validateEmail('luigi@carluccio.it')).toBe(true);
        });

        it('accepts John, whose address ends in a two letter country code after .com', () => {
            expect(validateEmail('john@silva.com.br')).toBe(true);
        });
    });

    describe('every account already in the database', () => {
        const emails = database.users.map((user: any) => user.email).filter(Boolean);

        it.each(emails)('accepts %s', (email) => {
            expect(validateEmail(email)).toBe(true);
        });
    });

    describe('top level domains of any length', () => {
        it.each([
            ['two letters', 'someone@example.ca'],
            ['two letters', 'someone@example.it'],
            ['three letters', 'someone@example.com'],
            ['three letters', 'someone@example.org'],
            ['four letters', 'someone@example.info'],
            ['six letters', 'someone@example.online'],
        ])('accepts a %s top level domain: %s', (_label, email) => {
            expect(validateEmail(email)).toBe(true);
        });
    });

    describe('domains with more than one label', () => {
        it.each(['someone@example.co.uk', 'someone@silva.com.br', 'someone@mail.example.com'])(
            'accepts %s',
            (email) => {
                expect(validateEmail(email)).toBe(true);
            }
        );
    });

    describe('local parts', () => {
        it.each([
            'someone@example.com',
            'first.last@example.com',
            'first_last@example.com',
            'first-last@example.com',
            'someone+newsletter@example.com',
            'user123@example.com',
        ])('accepts %s', (email) => {
            expect(validateEmail(email)).toBe(true);
        });
    });

    describe('normalisation', () => {
        it('accepts an address typed in capitals', () => {
            expect(validateEmail('LUIGI@CARLUCCIO.IT')).toBe(true);
        });

        it('accepts an address with surrounding whitespace', () => {
            expect(validateEmail('  luigi@carluccio.it  ')).toBe(true);
        });
    });

    describe('addresses that are genuinely malformed', () => {
        it.each([
            ['empty string', ''],
            ['no at sign', 'notanemail'],
            ['missing local part', '@example.com'],
            ['missing domain', 'someone@'],
            ['two at signs', 'someone@@example.com'],
            ['no top level domain', 'someone@example'],
            ['space in the local part', 'some one@example.com'],
            ['space in the domain', 'someone@exa mple.com'],
            ['consecutive dots', 'some..one@example.com'],
            ['domain label missing', 'someone@.com'],
            ['single letter top level domain', 'someone@example.c'],
        ])('rejects %s: "%s"', (_label, email) => {
            expect(validateEmail(email)).toBe(false);
        });
    });
});

describe('sanitizeEmail', () => {
    it('trims surrounding whitespace and lowercases', () => {
        expect(sanitizeEmail('  Luigi@Carluccio.IT ')).toBe('luigi@carluccio.it');
    });
});
