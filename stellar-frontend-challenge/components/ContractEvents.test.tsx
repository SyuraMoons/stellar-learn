import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ContractEvents from './ContractEvents';
import type { ContractEvent } from '@/lib/contract-events';

vi.mock('@/lib/stellar-helper', () => ({
  stellar: {
    getExplorerLink: (hash: string) => `https://stellar.expert/tx/${hash}`,
    formatAddress: (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`,
  },
}));

const mockFetchContractEvents = vi.fn();

vi.mock('@/lib/contract-events', () => ({
  fetchContractEvents: (...args: unknown[]) => mockFetchContractEvents(...args),
}));

describe('ContractEvents', () => {
  beforeEach(() => {
    mockFetchContractEvents.mockReset();
  });

  it('shows an empty state when there are no events yet', async () => {
    mockFetchContractEvents.mockResolvedValue({ events: [], cursor: 'c1' });

    render(<ContractEvents />);

    expect(await screen.findByText('No contract events yet')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('renders decoded events including a routed fee split', async () => {
    const events: ContractEvent[] = [
      {
        id: 'evt-1',
        type: 'routed',
        amountXlm: '99',
        feeXlm: '1',
        txHash: 'deadbeef',
        ledger: 100,
        at: new Date(),
      },
      {
        id: 'evt-2',
        type: 'claimed',
        amountXlm: '99',
        counterparty: 'GDESTINATIONACCOUNTADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        txHash: 'beefdead',
        ledger: 101,
        at: new Date(),
      },
    ];
    mockFetchContractEvents.mockResolvedValue({ events, cursor: 'c2' });

    render(<ContractEvents />);

    expect(await screen.findByText('Fee routed')).toBeInTheDocument();
    expect(screen.getByText(/99 XLM \(fee 1 XLM\)/)).toBeInTheDocument();
    expect(screen.getByText('Claimed')).toBeInTheDocument();
  });

  it('shows the Offline badge when polling fails', async () => {
    mockFetchContractEvents.mockRejectedValue(new Error('network down'));

    render(<ContractEvents />);

    await waitFor(() => {
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });
  });
});
