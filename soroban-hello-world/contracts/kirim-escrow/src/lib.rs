#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Bytes,
    BytesN, Env,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    PaymentExists = 3,
    PaymentNotFound = 4,
    InvalidAmount = 5,
    InvalidExpiry = 6,
    AlreadyFinalized = 7,
    Expired = 8,
    NotExpired = 9,
    WrongSecret = 10,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Status {
    Pending,
    Claimed,
    Refunded,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Payment {
    pub sender: Address,
    pub amount: i128,
    pub claim_hash: BytesN<32>,
    pub expiry: u64,
    pub status: Status,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Token,
    Payment(BytesN<32>),
}

#[contract]
pub struct KirimEscrow;

#[contractimpl]
impl KirimEscrow {
    pub fn initialize(env: Env, admin: Address, usdc_token: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &usdc_token);
        Ok(())
    }

    /// Escrow `amount` of USDC from `sender`, claimable by whoever knows the
    /// preimage of `claim_hash` until `expiry` (unix timestamp).
    pub fn create_payment(
        env: Env,
        sender: Address,
        amount: i128,
        claim_hash: BytesN<32>,
        expiry: u64,
    ) -> Result<(), Error> {
        sender.require_auth();
        let token = Self::token(&env)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if expiry <= env.ledger().timestamp() {
            return Err(Error::InvalidExpiry);
        }
        let key = DataKey::Payment(claim_hash.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::PaymentExists);
        }

        token::Client::new(&env, &token).transfer(
            &sender,
            &env.current_contract_address(),
            &amount,
        );

        let payment = Payment {
            sender,
            amount,
            claim_hash: claim_hash.clone(),
            expiry,
            status: Status::Pending,
        };
        env.storage().persistent().set(&key, &payment);
        env.events().publish(
            (symbol_short!("created"), claim_hash),
            (payment.amount, payment.expiry),
        );
        Ok(())
    }

    /// Pay out a pending payment to `destination`. Knowledge of `secret`
    /// (sha256 preimage of the stored claim hash) is the authorization.
    pub fn claim(env: Env, secret: Bytes, destination: Address) -> Result<(), Error> {
        let token = Self::token(&env)?;
        let claim_hash: BytesN<32> = env.crypto().sha256(&secret).into();
        let key = DataKey::Payment(claim_hash.clone());
        let mut payment: Payment = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::WrongSecret)?;

        if payment.status != Status::Pending {
            return Err(Error::AlreadyFinalized);
        }
        if env.ledger().timestamp() >= payment.expiry {
            return Err(Error::Expired);
        }

        token::Client::new(&env, &token).transfer(
            &env.current_contract_address(),
            &destination,
            &payment.amount,
        );

        payment.status = Status::Claimed;
        env.storage().persistent().set(&key, &payment);
        env.events().publish(
            (symbol_short!("claimed"), claim_hash),
            (destination, payment.amount),
        );
        Ok(())
    }

    /// Return escrowed funds to the original sender once the payment expired
    /// without being claimed.
    pub fn refund(env: Env, claim_hash: BytesN<32>) -> Result<(), Error> {
        let token = Self::token(&env)?;
        let key = DataKey::Payment(claim_hash.clone());
        let mut payment: Payment = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::PaymentNotFound)?;

        if payment.status != Status::Pending {
            return Err(Error::AlreadyFinalized);
        }
        if env.ledger().timestamp() < payment.expiry {
            return Err(Error::NotExpired);
        }

        token::Client::new(&env, &token).transfer(
            &env.current_contract_address(),
            &payment.sender,
            &payment.amount,
        );

        payment.status = Status::Refunded;
        env.storage().persistent().set(&key, &payment);
        env.events().publish(
            (symbol_short!("refunded"), claim_hash),
            (payment.sender.clone(), payment.amount),
        );
        Ok(())
    }

    pub fn get_payment(env: Env, claim_hash: BytesN<32>) -> Option<Payment> {
        env.storage()
            .persistent()
            .get(&DataKey::Payment(claim_hash))
    }

    fn token(env: &Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(Error::NotInitialized)
    }
}

mod test;
