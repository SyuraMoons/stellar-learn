#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, Bytes, Env,
};

const START_TIME: u64 = 1_000_000;
const EXPIRY: u64 = START_TIME + 3600;
const AMOUNT: i128 = 100_0000000; // 100 USDC (7 decimals)

struct Setup {
    env: Env,
    escrow: KirimEscrowClient<'static>,
    token: TokenClient<'static>,
    sender: Address,
    destination: Address,
    secret: Bytes,
    claim_hash: BytesN<32>,
}

fn setup() -> Setup {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.timestamp = START_TIME);

    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let token = TokenClient::new(&env, &sac.address());
    let token_admin = StellarAssetClient::new(&env, &sac.address());

    let sender = Address::generate(&env);
    let destination = Address::generate(&env);
    token_admin.mint(&sender, &1_000_0000000);

    let escrow_id = env.register(KirimEscrow, ());
    let escrow = KirimEscrowClient::new(&env, &escrow_id);
    let admin = Address::generate(&env);
    escrow.initialize(&admin, &sac.address());

    let secret = Bytes::from_slice(&env, b"kirim-demo-secret-0123456789abcd");
    let claim_hash: BytesN<32> = env.crypto().sha256(&secret).into();

    Setup {
        env,
        escrow,
        token,
        sender,
        destination,
        secret,
        claim_hash,
    }
}

#[test]
fn test_create_and_claim_happy_path() {
    let s = setup();
    s.escrow
        .create_payment(&s.sender, &AMOUNT, &s.claim_hash, &EXPIRY);

    assert_eq!(s.token.balance(&s.sender), 1_000_0000000 - AMOUNT);
    assert_eq!(s.token.balance(&s.escrow.address), AMOUNT);
    let payment = s.escrow.get_payment(&s.claim_hash).unwrap();
    assert_eq!(payment.status, Status::Pending);
    assert_eq!(payment.amount, AMOUNT);

    s.escrow.claim(&s.secret, &s.destination);

    assert_eq!(s.token.balance(&s.escrow.address), 0);
    assert_eq!(s.token.balance(&s.destination), AMOUNT);
    let payment = s.escrow.get_payment(&s.claim_hash).unwrap();
    assert_eq!(payment.status, Status::Claimed);
}

#[test]
fn test_claim_wrong_secret_fails() {
    let s = setup();
    s.escrow
        .create_payment(&s.sender, &AMOUNT, &s.claim_hash, &EXPIRY);

    let wrong = Bytes::from_slice(&s.env, b"not-the-secret");
    let result = s.escrow.try_claim(&wrong, &s.destination);
    assert_eq!(result, Err(Ok(Error::WrongSecret)));
    assert_eq!(s.token.balance(&s.escrow.address), AMOUNT);
}

#[test]
fn test_refund_before_expiry_fails() {
    let s = setup();
    s.escrow
        .create_payment(&s.sender, &AMOUNT, &s.claim_hash, &EXPIRY);

    let result = s.escrow.try_refund(&s.claim_hash);
    assert_eq!(result, Err(Ok(Error::NotExpired)));
}

#[test]
fn test_double_claim_fails() {
    let s = setup();
    s.escrow
        .create_payment(&s.sender, &AMOUNT, &s.claim_hash, &EXPIRY);
    s.escrow.claim(&s.secret, &s.destination);

    let result = s.escrow.try_claim(&s.secret, &s.destination);
    assert_eq!(result, Err(Ok(Error::AlreadyFinalized)));
    assert_eq!(s.token.balance(&s.destination), AMOUNT);
}

#[test]
fn test_refund_after_expiry_succeeds() {
    let s = setup();
    s.escrow
        .create_payment(&s.sender, &AMOUNT, &s.claim_hash, &EXPIRY);

    s.env.ledger().with_mut(|l| l.timestamp = EXPIRY);
    s.escrow.refund(&s.claim_hash);

    assert_eq!(s.token.balance(&s.sender), 1_000_0000000);
    assert_eq!(s.token.balance(&s.escrow.address), 0);
    let payment = s.escrow.get_payment(&s.claim_hash).unwrap();
    assert_eq!(payment.status, Status::Refunded);
}

#[test]
fn test_claim_after_expiry_fails() {
    let s = setup();
    s.escrow
        .create_payment(&s.sender, &AMOUNT, &s.claim_hash, &EXPIRY);

    s.env.ledger().with_mut(|l| l.timestamp = EXPIRY);
    let result = s.escrow.try_claim(&s.secret, &s.destination);
    assert_eq!(result, Err(Ok(Error::Expired)));
}

#[test]
fn test_create_duplicate_hash_fails() {
    let s = setup();
    s.escrow
        .create_payment(&s.sender, &AMOUNT, &s.claim_hash, &EXPIRY);

    let result = s
        .escrow
        .try_create_payment(&s.sender, &AMOUNT, &s.claim_hash, &EXPIRY);
    assert_eq!(result, Err(Ok(Error::PaymentExists)));
}

#[test]
fn test_initialize_twice_fails() {
    let s = setup();
    let admin = Address::generate(&s.env);
    let result = s.escrow.try_initialize(&admin, &s.token.address);
    assert_eq!(result, Err(Ok(Error::AlreadyInitialized)));
}
