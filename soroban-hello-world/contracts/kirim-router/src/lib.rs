#![no_std]
use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, symbol_short, token,
    Address, BytesN, Env,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 101,
    NotInitialized = 102,
    InvalidAmount = 103,
    InvalidFeeBps = 104,
    NetAmountZero = 105,
}

pub const MAX_FEE_BPS: u32 = 1000; // 10%
const FEE_BPS_DENOMINATOR: i128 = 10_000;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub admin: Address,
    pub token: Address,
    pub escrow: Address,
    pub treasury: Address,
    pub fee_bps: u32,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Config,
}

/// Minimal client for the kirim-escrow contract's `create_payment` entry
/// point. Declared as a trait (not imported via `contractimport!`/crate dep)
/// so this crate's wasm never exports escrow functions and the workspace
/// build has no ordering dependency on the escrow wasm artifact.
#[contractclient(name = "EscrowClient")]
pub trait EscrowInterface {
    fn create_payment(env: Env, sender: Address, amount: i128, claim_hash: BytesN<32>, expiry: u64);
}

#[contract]
pub struct KirimRouter;

#[contractimpl]
impl KirimRouter {
    pub fn initialize(
        env: Env,
        admin: Address,
        token: Address,
        escrow: Address,
        treasury: Address,
        fee_bps: u32,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Config) {
            return Err(Error::AlreadyInitialized);
        }
        if fee_bps > MAX_FEE_BPS {
            return Err(Error::InvalidFeeBps);
        }
        let config = Config {
            admin,
            token,
            escrow,
            treasury,
            fee_bps,
        };
        env.storage().instance().set(&DataKey::Config, &config);
        Ok(())
    }

    /// Take a platform fee (fee_bps / 10_000 of `amount`) into the treasury,
    /// then create a hashlock escrow payment on the kirim-escrow contract
    /// for the net amount. `sender` is the original user, so refunds and the
    /// escrow record's `sender` field point back at the user, not the
    /// router.
    pub fn send_remittance(
        env: Env,
        sender: Address,
        amount: i128,
        claim_hash: BytesN<32>,
        expiry: u64,
    ) -> Result<i128, Error> {
        sender.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let config = Self::config(&env)?;

        let fee = amount * (config.fee_bps as i128) / FEE_BPS_DENOMINATOR;
        let net = amount - fee;
        if net <= 0 {
            return Err(Error::NetAmountZero);
        }

        if fee > 0 {
            token::Client::new(&env, &config.token).transfer(&sender, &config.treasury, &fee);
        }

        EscrowClient::new(&env, &config.escrow).create_payment(&sender, &net, &claim_hash, &expiry);

        #[allow(deprecated)]
        env.events()
            .publish((symbol_short!("routed"), claim_hash), (fee, net));

        Ok(net)
    }

    pub fn set_fee_bps(env: Env, new_fee_bps: u32) -> Result<(), Error> {
        let mut config = Self::config(&env)?;
        config.admin.require_auth();
        if new_fee_bps > MAX_FEE_BPS {
            return Err(Error::InvalidFeeBps);
        }
        config.fee_bps = new_fee_bps;
        env.storage().instance().set(&DataKey::Config, &config);
        Ok(())
    }

    pub fn set_treasury(env: Env, new_treasury: Address) -> Result<(), Error> {
        let mut config = Self::config(&env)?;
        config.admin.require_auth();
        config.treasury = new_treasury;
        env.storage().instance().set(&DataKey::Config, &config);
        Ok(())
    }

    pub fn get_config(env: Env) -> Result<Config, Error> {
        Self::config(&env)
    }

    fn config(env: &Env) -> Result<Config, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(Error::NotInitialized)
    }
}

mod test;
