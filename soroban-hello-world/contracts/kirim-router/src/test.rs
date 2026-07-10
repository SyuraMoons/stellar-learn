#![cfg(test)]
// Amount literals are grouped as `<whole>_<7-decimal fraction>` to mirror
// Stellar's 7-decimal asset precision, not by thousands.
#![allow(clippy::inconsistent_digit_grouping)]

use super::*;
use kirim_escrow::{Error as EscrowError, KirimEscrow, KirimEscrowClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, Bytes, Env,
};

const START_TIME: u64 = 1_000_000;
const EXPIRY: u64 = START_TIME + 3600;
const AMOUNT: i128 = 100_0000000; // 100 units, 7 decimals
const FEE_BPS: u32 = 100; // 1%
const STARTING_BALANCE: i128 = 1_000_0000000;

struct Setup {
    env: Env,
    router: KirimRouterClient<'static>,
    escrow: KirimEscrowClient<'static>,
    token: TokenClient<'static>,
    admin: Address,
    sender: Address,
    treasury: Address,
    destination: Address,
    secret: Bytes,
    claim_hash: BytesN<32>,
}

fn setup_with_fee(fee_bps: u32) -> Setup {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.timestamp = START_TIME);

    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let token = TokenClient::new(&env, &sac.address());
    let token_admin = StellarAssetClient::new(&env, &sac.address());

    let sender = Address::generate(&env);
    let treasury = Address::generate(&env);
    let destination = Address::generate(&env);
    token_admin.mint(&sender, &STARTING_BALANCE);

    let escrow_id = env.register(KirimEscrow, ());
    let escrow = KirimEscrowClient::new(&env, &escrow_id);
    let escrow_admin = Address::generate(&env);
    escrow.initialize(&escrow_admin, &sac.address());

    let router_id = env.register(KirimRouter, ());
    let router = KirimRouterClient::new(&env, &router_id);
    let admin = Address::generate(&env);
    router.initialize(&admin, &sac.address(), &escrow_id, &treasury, &fee_bps);

    let secret = Bytes::from_slice(&env, b"kirim-router-secret-0123456789ab");
    let claim_hash: BytesN<32> = env.crypto().sha256(&secret).into();

    Setup {
        env,
        router,
        escrow,
        token,
        admin,
        sender,
        treasury,
        destination,
        secret,
        claim_hash,
    }
}

fn setup() -> Setup {
    setup_with_fee(FEE_BPS)
}

#[test]
fn test_send_remittance_splits_fee() {
    let s = setup();
    let net = s
        .router
        .send_remittance(&s.sender, &AMOUNT, &s.claim_hash, &EXPIRY);

    let expected_fee = AMOUNT * (FEE_BPS as i128) / 10_000;
    let expected_net = AMOUNT - expected_fee;
    assert_eq!(net, expected_net);

    assert_eq!(s.token.balance(&s.sender), STARTING_BALANCE - AMOUNT);
    assert_eq!(s.token.balance(&s.treasury), expected_fee);
    assert_eq!(s.token.balance(&s.escrow.address), expected_net);

    let payment = s.escrow.get_payment(&s.claim_hash).unwrap();
    assert_eq!(payment.sender, s.sender);
    assert_eq!(payment.amount, expected_net);
}

#[test]
fn test_claim_after_routed_send() {
    let s = setup();
    s.router
        .send_remittance(&s.sender, &AMOUNT, &s.claim_hash, &EXPIRY);

    s.escrow.claim(&s.secret, &s.destination);

    let expected_fee = AMOUNT * (FEE_BPS as i128) / 10_000;
    let expected_net = AMOUNT - expected_fee;
    assert_eq!(s.token.balance(&s.destination), expected_net);
    assert_eq!(s.token.balance(&s.escrow.address), 0);
}

#[test]
fn test_refund_after_routed_send_returns_to_user() {
    let s = setup();
    s.router
        .send_remittance(&s.sender, &AMOUNT, &s.claim_hash, &EXPIRY);

    s.env.ledger().with_mut(|l| l.timestamp = EXPIRY);
    s.escrow.refund(&s.claim_hash);

    let expected_fee = AMOUNT * (FEE_BPS as i128) / 10_000;
    let expected_net = AMOUNT - expected_fee;
    // The user (not the router) receives the refund: they only ever lost
    // the platform fee, proving the escrow's `sender` is the original user.
    assert_eq!(
        s.token.balance(&s.sender),
        STARTING_BALANCE - AMOUNT + expected_net
    );
    assert_eq!(s.token.balance(&s.router.address), 0);
}

#[test]
fn test_zero_fee_routes_full_amount() {
    let s = setup_with_fee(0);
    let net = s
        .router
        .send_remittance(&s.sender, &AMOUNT, &s.claim_hash, &EXPIRY);

    assert_eq!(net, AMOUNT);
    assert_eq!(s.token.balance(&s.treasury), 0);
    assert_eq!(s.token.balance(&s.escrow.address), AMOUNT);
}

#[test]
fn test_fee_rounding_floor() {
    let s = setup_with_fee(25); // 0.25%
    let amount: i128 = 999;
    let net = s
        .router
        .send_remittance(&s.sender, &amount, &s.claim_hash, &EXPIRY);

    // 999 * 25 / 10_000 = 2 (floor division)
    assert_eq!(net, 997);
    assert_eq!(s.token.balance(&s.treasury), 2);
}

#[test]
fn test_zero_amount_fails() {
    let s = setup();
    let result = s
        .router
        .try_send_remittance(&s.sender, &0, &s.claim_hash, &EXPIRY);
    assert_eq!(result, Err(Ok(Error::InvalidAmount)));
}

#[test]
fn test_initialize_invalid_fee_bps_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let escrow_id = env.register(KirimEscrow, ());
    let router_id = env.register(KirimRouter, ());
    let router = KirimRouterClient::new(&env, &router_id);
    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);

    let result = router.try_initialize(
        &admin,
        &sac.address(),
        &escrow_id,
        &treasury,
        &(MAX_FEE_BPS + 1),
    );
    assert_eq!(result, Err(Ok(Error::InvalidFeeBps)));
}

#[test]
fn test_set_fee_bps_above_max_fails() {
    let s = setup();
    let result = s.router.try_set_fee_bps(&(MAX_FEE_BPS + 1));
    assert_eq!(result, Err(Ok(Error::InvalidFeeBps)));
}

#[test]
fn test_set_fee_bps_and_treasury_update_config() {
    let s = setup();
    let new_treasury = Address::generate(&s.env);
    s.router.set_fee_bps(&250);
    s.router.set_treasury(&new_treasury);

    let config = s.router.get_config();
    assert_eq!(config.fee_bps, 250);
    assert_eq!(config.treasury, new_treasury);
    assert_eq!(config.admin, s.admin);
}

#[test]
fn test_initialize_twice_fails() {
    let s = setup();
    let result = s.router.try_initialize(
        &s.admin,
        &s.token.address,
        &s.escrow.address,
        &s.treasury,
        &FEE_BPS,
    );
    assert_eq!(result, Err(Ok(Error::AlreadyInitialized)));
}

#[test]
fn test_duplicate_claim_hash_propagates_escrow_error() {
    let s = setup();
    s.router
        .send_remittance(&s.sender, &AMOUNT, &s.claim_hash, &EXPIRY);

    let sender_balance_after_first = s.token.balance(&s.sender);
    let treasury_balance_after_first = s.token.balance(&s.treasury);

    let result = s
        .router
        .try_send_remittance(&s.sender, &AMOUNT, &s.claim_hash, &EXPIRY);
    assert!(result.is_err());

    // The nested escrow failure aborts the whole invocation: no additional
    // fee should have left the sender's account.
    assert_eq!(s.token.balance(&s.sender), sender_balance_after_first);
    assert_eq!(s.token.balance(&s.treasury), treasury_balance_after_first);

    let _ = EscrowError::PaymentExists; // documents which escrow error triggers this path
}
