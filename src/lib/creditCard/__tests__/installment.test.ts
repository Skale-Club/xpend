import { describe, it, expect } from 'vitest';
import { parseInstallment } from '@/lib/creditCard/installment';

describe('parseInstallment', () => {
  it('parses keyword forms anywhere in the description', () => {
    expect(parseInstallment('LOJA X PARC 03/12')).toEqual({ number: 3, total: 12 });
    expect(parseInstallment('Parcela 3 de 12 - LOJA X')).toEqual({ number: 3, total: 12 });
  });

  it('parses bare NN/NN only at the end of the string', () => {
    expect(parseInstallment('AMAZON BR 02/06')).toEqual({ number: 2, total: 6 });
    expect(parseInstallment('voo 03/12 GRU-SDU')).toBeNull();
  });

  it('rejects implausible series', () => {
    expect(parseInstallment('LOJA 05/01')).toBeNull(); // number > total
    expect(parseInstallment('LOJA 01/01')).toBeNull(); // total < 2
    expect(parseInstallment('')).toBeNull();
    expect(parseInstallment('LOJA SEM PARCELA')).toBeNull();
  });
});
