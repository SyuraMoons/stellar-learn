import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EscrowPanel from './EscrowPanel';

vi.mock('@/lib/stellar-helper', () => ({
  stellar: {
    getExplorerLink: (hash: string) => `https://stellar.expert/tx/${hash}`,
    formatAddress: (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`,
  },
}));

const mockGetRouterConfig = vi.fn();
const mockCreateEscrow = vi.fn();
const mockClaimEscrow = vi.fn();

vi.mock('@/lib/contract', async () => {
  const actual = await vi.importActual<typeof import('@/lib/contract')>(
    '@/lib/contract'
  );
  return {
    ...actual,
    getRouterConfig: (...args: unknown[]) => mockGetRouterConfig(...args),
    createEscrow: (...args: unknown[]) => mockCreateEscrow(...args),
    claimEscrow: (...args: unknown[]) => mockClaimEscrow(...args),
  };
});

const PUBLIC_KEY = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';

describe('EscrowPanel', () => {
  beforeEach(() => {
    mockGetRouterConfig.mockReset();
    mockCreateEscrow.mockReset();
    mockClaimEscrow.mockReset();
  });

  it('shows a live fee breakdown once the router config loads', async () => {
    mockGetRouterConfig.mockResolvedValue({ feeBps: 100, treasury: 'GTREASURY' });
    const user = userEvent.setup();

    render(<EscrowPanel publicKey={PUBLIC_KEY} />);

    const amountInput = await screen.findByPlaceholderText('0.00');
    await user.type(amountInput, '100');

    await waitFor(() => {
      expect(screen.getByText('Recipient receives')).toBeInTheDocument();
    });
    expect(screen.getByText('99 XLM')).toBeInTheDocument(); // 100 - 1% fee
    expect(screen.getByText(/Platform fee \(1%\)/)).toBeInTheDocument();
  });

  it('shows the claim-code panel after a successful send', async () => {
    mockGetRouterConfig.mockResolvedValue({ feeBps: 100, treasury: 'GTREASURY' });
    mockCreateEscrow.mockResolvedValue({
      secretHex: 'a'.repeat(64),
      txHash: 'deadbeef',
      expiresAt: new Date(),
    });
    const user = userEvent.setup();

    render(<EscrowPanel publicKey={PUBLIC_KEY} />);

    const amountInput = await screen.findByPlaceholderText('0.00');
    await user.type(amountInput, '50');
    await user.click(screen.getByRole('button', { name: /lock in escrow/i }));

    await waitFor(() => {
      expect(mockCreateEscrow).toHaveBeenCalledWith(
        expect.objectContaining({ sender: PUBLIC_KEY, amountXlm: '50' })
      );
    });
    expect(await screen.findByText('Claim code')).toBeInTheDocument();
    expect(screen.getByText('a'.repeat(64))).toBeInTheDocument();
  });
});
